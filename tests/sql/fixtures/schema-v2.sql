-- =============================================================================
--  Il Quiz – Schema database Supabase (PostgreSQL)
-- -----------------------------------------------------------------------------
--  Eseguire l'intero file nel SQL Editor di Supabase (Dashboard → SQL Editor →
--  New query → incolla → Run). Lo script è idempotente: può essere rieseguito
--  e aggiorna un database creato con la versione precedente senza perdere le
--  domande già inserite.
--
--  Flusso:
--   1. La cassa genera un QR monouso (entry_qr_codes, si salva solo l'hash).
--   2. Il cliente lo usa una sola volta (redeem_entry, operazione atomica):
--      viene creato un partecipante con la sua età e gli viene assegnata una
--      domanda casuale del ciclo giornaliero (daily_question_assignments).
--   3. La risposta viene verificata nel DB (submit_participant_answer): se
--      corretta il premio è deciso dall'età e viene creato un codice premio.
--   4. La cassa riscatta il codice una sola volta (cassa_redeem_prize).
--
--  Sicurezza:
--   * RLS attivo e forzato su tutte le tabelle, nessuna policy pubblica.
--   * Funzioni eseguibili solo dalla service_role (server Next.js).
--   * La risposta corretta non esce mai dal database.
-- =============================================================================

-- gen_random_uuid() è nativa da PostgreSQL 13 (nessuna estensione necessaria).

-- -----------------------------------------------------------------------------
--  Domande
-- -----------------------------------------------------------------------------

create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  question_text  text not null check (char_length(btrim(question_text)) between 1 and 500),
  answer_a       text not null check (char_length(btrim(answer_a)) between 1 and 200),
  answer_b       text not null check (char_length(btrim(answer_b)) between 1 and 200),
  answer_c       text not null check (char_length(btrim(answer_c)) between 1 and 200),
  answer_d       text not null check (char_length(btrim(answer_d)) between 1 and 200),
  correct_answer char(1) not null check (correct_answer in ('A', 'B', 'C', 'D')),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists questions_active_idx on public.questions (is_active);

-- -----------------------------------------------------------------------------
--  Storico della versione precedente (una domanda al giorno uguale per tutti).
--  Le tabelle restano per conservare i dati, ma non sono più utilizzate.
-- -----------------------------------------------------------------------------

create table if not exists public.daily_questions (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references public.questions (id) on delete cascade,
  question_date date not null unique,
  created_at    timestamptz not null default now()
);

create table if not exists public.responses (
  id              bigint generated always as identity primary key,
  question_id     uuid not null references public.questions (id) on delete cascade,
  question_date   date not null,
  participant_id  uuid not null,
  selected_answer char(1) not null check (selected_answer in ('A', 'B', 'C', 'D')),
  is_correct      boolean not null,
  created_at      timestamptz not null default now(),
  unique (question_date, participant_id)
);

-- -----------------------------------------------------------------------------
--  Premi
-- -----------------------------------------------------------------------------

-- Configurazione dei premi (etichetta + fotografia caricata dall'amministratore).
create table if not exists public.prize_settings (
  prize_type  text primary key check (prize_type in ('braccialetto', 'cono', 'caffe')),
  label       text not null,
  image_path  text,
  updated_at  timestamptz not null default now()
);

insert into public.prize_settings (prize_type, label) values
  ('braccialetto', 'Braccialetto'),
  ('cono', 'Cono'),
  ('caffe', 'Caffè')
on conflict (prize_type) do nothing;

-- Messaggio di vittoria personalizzabile dall'amministratore (null = predefinito).
alter table public.prize_settings add column if not exists win_message text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prize_settings_label_len') then
    alter table public.prize_settings
      add constraint prize_settings_label_len check (char_length(btrim(label)) between 1 and 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prize_settings_win_message_len') then
    alter table public.prize_settings
      add constraint prize_settings_win_message_len
      check (win_message is null or char_length(btrim(win_message)) between 1 and 120);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
--  Partecipanti (una partecipazione = un QR = una domanda = una risposta)
-- -----------------------------------------------------------------------------

create table if not exists public.participants (
  id              uuid primary key default gen_random_uuid(),
  age             integer not null check (age between 0 and 120),
  question_id     uuid references public.questions (id) on delete set null,
  assignment_date date not null,
  selected_answer char(1) check (selected_answer in ('A', 'B', 'C', 'D')),
  is_correct      boolean,
  prize_type      text references public.prize_settings (prize_type),
  created_at      timestamptz not null default now(),
  answered_at     timestamptz,
  -- La risposta e l'esito sono registrati insieme, una sola volta.
  check ((selected_answer is null) = (is_correct is null)),
  check (prize_type is null or is_correct)
);

create index if not exists participants_created_idx on public.participants (created_at);
create index if not exists participants_date_idx on public.participants (assignment_date);

-- QR code monouso generati dalla cassa. Si salva SOLO l'hash SHA-256 del token.
create table if not exists public.entry_qr_codes (
  id             uuid primary key default gen_random_uuid(),
  token_hash     text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status         text not null default 'pending' check (status in ('pending', 'used', 'cancelled')),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  used_at        timestamptz,
  participant_id uuid unique references public.participants (id) on delete set null,
  created_by     text,
  check ((status = 'used') = (used_at is not null))
);

create index if not exists entry_qr_codes_created_idx on public.entry_qr_codes (created_at);

-- Codici premio: univoci, uno per partecipante vincitore, riscattabili una volta.
create table if not exists public.prize_codes (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^QUIZ-[2-9A-HJ-NP-Z]{6}$'),
  participant_id uuid not null unique references public.participants (id) on delete cascade,
  prize_type     text not null references public.prize_settings (prize_type),
  status         text not null default 'pending' check (status in ('pending', 'redeemed')),
  created_at     timestamptz not null default now(),
  redeemed_at    timestamptz,
  redeemed_by    text,
  check ((status = 'redeemed') = (redeemed_at is not null))
);

create index if not exists prize_codes_status_idx on public.prize_codes (status, redeemed_at desc);

-- Assegnazione domanda ↔ partecipante per data italiana (storico completo).
create table if not exists public.daily_question_assignments (
  id              uuid primary key default gen_random_uuid(),
  question_id     uuid not null references public.questions (id) on delete cascade,
  participant_id  uuid not null unique references public.participants (id) on delete cascade,
  assignment_date date not null,
  created_at      timestamptz not null default now()
);

create index if not exists dqa_date_question_idx on public.daily_question_assignments (assignment_date, question_id);
create index if not exists dqa_date_created_idx on public.daily_question_assignments (assignment_date, created_at desc);

-- Rate limiting persistente (funziona anche con più istanze serverless).
create table if not exists public.rate_limits (
  key          text primary key,
  count        integer not null default 0,
  window_start timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
--  Trigger updated_at
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
--  Row Level Security: attiva ovunque, nessuna policy = accesso negato
--  a anon/authenticated. La service_role bypassa RLS (solo lato server).
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'questions', 'daily_questions', 'responses', 'prize_settings', 'participants',
    'entry_qr_codes', 'prize_codes', 'daily_question_assignments', 'rate_limits'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
--  Rimozione delle funzioni della versione precedente
-- -----------------------------------------------------------------------------

drop function if exists public.get_daily_question(date, uuid);
drop function if exists public.submit_answer(uuid, text, uuid, date);
drop function if exists public.pick_next_question(uuid);

-- -----------------------------------------------------------------------------
--  Utility
-- -----------------------------------------------------------------------------

-- Data corrente nel fuso orario Europe/Rome.
create or replace function public.rome_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Europe/Rome')::date;
$$;

-- Premio in base all'età (unica fonte di verità).
create or replace function public.prize_for_age(p_age integer)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_age is null or p_age < 0 then null
    when p_age <= 10 then 'braccialetto'
    when p_age <= 17 then 'cono'
    else 'caffe'
  end;
$$;

-- Codice premio casuale "QUIZ-XXXXXX" (32 simboli senza 0/O/1/I).
-- Usa gen_random_uuid() come sorgente crittograficamente sicura.
create or replace function public.generate_prize_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes    bytea := uuid_send(gen_random_uuid());
  v_out    text := 'QUIZ-';
begin
  -- I primi 6 byte di un UUID v4 sono interamente casuali.
  for i in 0..5 loop
    v_out := v_out || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return v_out;
end;
$$;

-- Assegna una domanda casuale del ciclo giornaliero.
-- Regole: si sceglie tra le domande attive assegnate meno volte oggi (quindi
-- prima tutte quelle non ancora usate oggi; esaurite, inizia un nuovo ciclo);
-- se possibile si evita la domanda assegnata per ultima. L'advisory lock
-- serializza le assegnazioni della stessa data: due richieste simultanee non
-- ricevono la stessa domanda finché ce ne sono altre disponibili.
create or replace function public.assign_question(p_participant uuid, p_date date)
returns uuid
language plpgsql
volatile
set search_path = public
as $$
declare
  v_last   uuid;
  v_pick   uuid;
begin
  perform pg_advisory_xact_lock(hashtext('quiz_assign:' || p_date::text));

  select a.question_id into v_last
  from public.daily_question_assignments a
  where a.assignment_date = p_date
  order by a.created_at desc, a.id desc
  limit 1;

  with counts as (
    select q.id,
           (select count(*) from public.daily_question_assignments a
             where a.assignment_date = p_date and a.question_id = q.id) as n
    from public.questions q
    where q.is_active
  ),
  pool as (
    select id from counts where n = (select min(n) from counts)
  )
  select id into v_pick
  from pool
  order by (id = v_last and (select count(*) from pool) > 1), random()
  limit 1;

  if v_pick is null then
    return null;
  end if;

  insert into public.daily_question_assignments (question_id, participant_id, assignment_date)
  values (v_pick, p_participant, p_date);

  update public.participants set question_id = v_pick where id = p_participant;
  return v_pick;
end;
$$;

-- -----------------------------------------------------------------------------
--  Partecipante: utilizzo del QR, stato, risposta
-- -----------------------------------------------------------------------------

-- Stato di un QR (sola lettura) per la pagina di ingresso.
-- 'mine' = già utilizzato proprio da questo partecipante (es. ricarica pagina).
create or replace function public.entry_status(p_token_hash text, p_participant uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('status',
    case
      when e.id is null then 'invalid'
      when e.status = 'used' and p_participant is not null and e.participant_id = p_participant then 'mine'
      when e.status <> 'pending' then 'invalid'
      when e.expires_at <= now() then 'invalid'
      else 'valid'
    end)
  from (select 1) dummy
  left join public.entry_qr_codes e on e.token_hash = p_token_hash;
$$;

-- Utilizzo ATOMICO del QR: un solo UPDATE condizionale lo marca come usato.
-- Con due richieste simultanee, la seconda attende il lock di riga e poi non
-- trova più status = 'pending': riceve 'invalid'.
create or replace function public.redeem_entry(p_token_hash text, p_age integer, p_date date default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_date        date := coalesce(p_date, public.rome_today());
  v_entry       uuid;
  v_participant uuid;
  v_question    uuid;
begin
  if p_age is null or p_age < 0 or p_age > 120 then
    raise exception 'invalid_age' using errcode = '22023';
  end if;

  update public.entry_qr_codes
     set status = 'used', used_at = now()
   where token_hash = p_token_hash
     and status = 'pending'
     and expires_at > now()
  returning id into v_entry;

  if v_entry is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.participants (age, assignment_date)
  values (p_age, v_date)
  returning id into v_participant;

  update public.entry_qr_codes set participant_id = v_participant where id = v_entry;

  v_question := public.assign_question(v_participant, v_date);

  return jsonb_build_object(
    'status', 'ok',
    'participant_id', v_participant,
    'has_question', v_question is not null
  );
end;
$$;

-- Stato del partecipante (mai la risposta corretta).
create or replace function public.get_participant_state(p_participant uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'participant_id', p.id,
    'age',            p.age,
    'answered',       p.selected_answer is not null,
    'is_correct',     p.is_correct,
    'question',       case when q.id is null then null else jsonb_build_object(
                        'id', q.id,
                        'question_text', q.question_text,
                        'answer_a', q.answer_a,
                        'answer_b', q.answer_b,
                        'answer_c', q.answer_c,
                        'answer_d', q.answer_d) end,
    'prize',          case when pc.id is null then null else jsonb_build_object(
                        'type', pc.prize_type,
                        'label', ps.label,
                        'win_message', ps.win_message,
                        'image_path', ps.image_path,
                        'code', pc.code,
                        'status', pc.status,
                        'redeemed_at', pc.redeemed_at) end
  )
  from public.participants p
  left join public.questions q on q.id = p.question_id
  left join public.prize_codes pc on pc.participant_id = p.id
  left join public.prize_settings ps on ps.prize_type = pc.prize_type
  where p.id = p_participant;
$$;

-- Verifica della risposta + assegnazione automatica del premio.
-- status: 'ok' | 'already_answered' | 'no_question' | 'not_found'
create or replace function public.submit_participant_answer(p_participant uuid, p_answer text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_answer  text := upper(btrim(coalesce(p_answer, '')));
  v_p       public.participants%rowtype;
  v_correct char(1);
  v_ok      boolean;
  v_prize   text;
  v_code    text;
begin
  if v_answer not in ('A', 'B', 'C', 'D') then
    raise exception 'invalid_answer' using errcode = '22023';
  end if;

  -- Lock della riga: due invii simultanei vengono serializzati.
  select * into v_p from public.participants where id = p_participant for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_p.selected_answer is not null then
    return jsonb_build_object('status', 'already_answered', 'correct', v_p.is_correct);
  end if;
  if v_p.question_id is null then
    return jsonb_build_object('status', 'no_question');
  end if;

  select q.correct_answer into v_correct from public.questions q where q.id = v_p.question_id;
  v_ok := (v_correct = v_answer);
  v_prize := case when v_ok then public.prize_for_age(v_p.age) else null end;

  update public.participants
     set selected_answer = v_answer, is_correct = v_ok, prize_type = v_prize, answered_at = now()
   where id = p_participant;

  if v_ok then
    -- Codice univoco: in caso (rarissimo) di collisione si rigenera.
    loop
      v_code := public.generate_prize_code();
      begin
        insert into public.prize_codes (code, participant_id, prize_type)
        values (v_code, p_participant, v_prize);
        exit;
      exception when unique_violation then
        if exists (select 1 from public.prize_codes where participant_id = p_participant) then
          exit;
        end if;
      end;
    end loop;
  end if;

  return jsonb_build_object('status', 'ok', 'correct', v_ok);
end;
$$;

-- -----------------------------------------------------------------------------
--  Cassa
-- -----------------------------------------------------------------------------

create or replace function public.cassa_create_entry(p_token_hash text, p_ttl_minutes integer, p_created_by text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.entry_qr_codes%rowtype;
begin
  insert into public.entry_qr_codes (token_hash, expires_at, created_by)
  values (p_token_hash, now() + make_interval(mins => greatest(p_ttl_minutes, 1)), p_created_by)
  returning * into v_row;
  return jsonb_build_object('id', v_row.id, 'expires_at', v_row.expires_at, 'created_at', v_row.created_at);
end;
$$;

create or replace function public.cassa_entry_status(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id,
    'status', case when e.status = 'pending' and e.expires_at <= now() then 'expired' else e.status end,
    'expires_at', e.expires_at,
    'used_at', e.used_at)
  from public.entry_qr_codes e
  where e.id = p_id;
$$;

create or replace function public.cassa_cancel_entry(p_id uuid)
returns jsonb
language sql
volatile
security definer
set search_path = public
as $$
  with u as (
    update public.entry_qr_codes set status = 'cancelled'
     where id = p_id and status = 'pending'
    returning 1
  )
  select jsonb_build_object('cancelled', (select count(*) from u) > 0);
$$;

-- Normalizza il codice digitato: maiuscole, senza spazi, prefisso facoltativo.
create or replace function public.normalize_prize_code(p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when raw ~ '^QUIZ[2-9A-HJ-NP-Z]{6}$' then 'QUIZ-' || substr(raw, 5)
    when raw ~ '^[2-9A-HJ-NP-Z]{6}$' then 'QUIZ-' || raw
    else raw
  end
  from (select regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g') as raw) r;
$$;

-- status: 'pending' | 'redeemed' | 'not_found'
create or replace function public.cassa_lookup_prize(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
       'status', pc.status, 'code', pc.code, 'prize_type', pc.prize_type, 'label', ps.label,
       'image_path', ps.image_path, 'created_at', pc.created_at, 'redeemed_at', pc.redeemed_at)
     from public.prize_codes pc
     join public.prize_settings ps on ps.prize_type = pc.prize_type
     where pc.code = public.normalize_prize_code(p_code)),
    jsonb_build_object('status', 'not_found'));
$$;

-- Riscatto ATOMICO: UPDATE condizionale su status = 'pending'.
-- status: 'redeemed' (appena riscattato) | 'already_redeemed' | 'not_found'
create or replace function public.cassa_redeem_prize(p_code text, p_redeemed_by text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_code text := public.normalize_prize_code(p_code);
  v_row  public.prize_codes%rowtype;
begin
  update public.prize_codes
     set status = 'redeemed', redeemed_at = now(), redeemed_by = p_redeemed_by
   where code = v_code and status = 'pending'
  returning * into v_row;

  if found then
    return jsonb_build_object('status', 'redeemed', 'code', v_row.code, 'prize_type', v_row.prize_type,
                              'label', (select label from public.prize_settings where prize_type = v_row.prize_type),
                              'redeemed_at', v_row.redeemed_at);
  end if;

  select * into v_row from public.prize_codes where code = v_code;
  if found then
    return jsonb_build_object('status', 'already_redeemed', 'code', v_row.code, 'prize_type', v_row.prize_type,
                              'label', (select label from public.prize_settings where prize_type = v_row.prize_type),
                              'redeemed_at', v_row.redeemed_at);
  end if;
  return jsonb_build_object('status', 'not_found');
end;
$$;

create or replace function public.cassa_list_redemptions(p_limit integer default 100)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(row_to_json(t) order by t.redeemed_at desc)
      from (
        select pc.code, pc.prize_type, ps.label, pc.redeemed_at, pc.created_at
        from public.prize_codes pc
        join public.prize_settings ps on ps.prize_type = pc.prize_type
        where pc.status = 'redeemed'
        order by pc.redeemed_at desc
        limit least(greatest(p_limit, 1), 500)
      ) t), '[]'::jsonb),
    'redeemed_today', (select count(*) from public.prize_codes
                        where status = 'redeemed'
                          and (redeemed_at at time zone 'Europe/Rome')::date = public.rome_today()),
    'pending_total', (select count(*) from public.prize_codes where status = 'pending')
  );
$$;

-- -----------------------------------------------------------------------------
--  Rate limiting atomico a finestra fissa.
-- -----------------------------------------------------------------------------

create or replace function public.check_rate_limit(
  p_key            text,
  p_max            integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_count  integer;
  v_start  timestamptz;
  v_window interval := make_interval(secs => p_window_seconds);
begin
  insert into public.rate_limits as rl (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case when rl.window_start < now() - v_window then 1 else rl.count + 1 end,
        window_start = case when rl.window_start < now() - v_window then now() else rl.window_start end
  returning rl.count, rl.window_start into v_count, v_start;

  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return jsonb_build_object(
    'allowed',     v_count <= p_max,
    'remaining',   greatest(p_max - v_count, 0),
    'retry_after', greatest(ceil(extract(epoch from (v_start + v_window - now())))::int, 0)
  );
end;
$$;

create or replace function public.reset_rate_limit(p_key text)
returns jsonb
language sql
volatile
security definer
set search_path = public
as $$
  with d as (delete from public.rate_limits where key = p_key returning 1)
  select jsonb_build_object('reset', (select count(*) from d) > 0);
$$;

-- -----------------------------------------------------------------------------
--  Amministrazione
-- -----------------------------------------------------------------------------

create or replace function public.admin_list_questions()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
  from (
    select q.id, q.question_text, q.answer_a, q.answer_b, q.answer_c, q.answer_d,
           q.correct_answer, q.is_active, q.created_at, q.updated_at,
           (select max(a.assignment_date) from public.daily_question_assignments a where a.question_id = q.id) as last_used_date,
           (select count(*) from public.daily_question_assignments a where a.question_id = q.id)::int as times_used
    from public.questions q
  ) t;
$$;

create or replace function public.admin_get_question(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(q) from public.questions q where q.id = p_id;
$$;

create or replace function public.admin_create_question(
  p_question_text  text,
  p_answer_a       text,
  p_answer_b       text,
  p_answer_c       text,
  p_answer_d       text,
  p_correct_answer text,
  p_is_active      boolean default true
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.questions%rowtype;
begin
  insert into public.questions (question_text, answer_a, answer_b, answer_c, answer_d, correct_answer, is_active)
  values (btrim(p_question_text), btrim(p_answer_a), btrim(p_answer_b), btrim(p_answer_c), btrim(p_answer_d),
          upper(btrim(p_correct_answer)), coalesce(p_is_active, true))
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.admin_update_question(
  p_id             uuid,
  p_question_text  text,
  p_answer_a       text,
  p_answer_b       text,
  p_answer_c       text,
  p_answer_d       text,
  p_correct_answer text,
  p_is_active      boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.questions%rowtype;
begin
  update public.questions
     set question_text  = btrim(p_question_text),
         answer_a       = btrim(p_answer_a),
         answer_b       = btrim(p_answer_b),
         answer_c       = btrim(p_answer_c),
         answer_d       = btrim(p_answer_d),
         correct_answer = upper(btrim(p_correct_answer)),
         is_active      = p_is_active
   where id = p_id
  returning * into v_row;

  if not found then
    return null;
  end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.admin_set_question_active(p_id uuid, p_is_active boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.questions%rowtype;
begin
  update public.questions set is_active = p_is_active where id = p_id returning * into v_row;
  if not found then
    return null;
  end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.admin_delete_question(p_id uuid)
returns jsonb
language sql
volatile
security definer
set search_path = public
as $$
  with d as (delete from public.questions where id = p_id returning id)
  select jsonb_build_object('deleted', (select count(*) from d) > 0);
$$;

-- Statistiche cumulative (tutta la storia) + giornata corrente.
create or replace function public.admin_get_stats(p_date date default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with d as (select coalesce(p_date, public.rome_today()) as day),
  brackets(label, lo, hi, ord) as (
    values ('0–10', 0, 10, 1), ('11–17', 11, 17, 2), ('18–29', 18, 29, 3),
           ('30–44', 30, 44, 4), ('45–64', 45, 64, 5), ('65+', 65, 200, 6)
  ),
  tot as (select count(*)::numeric as n from public.participants)
  select jsonb_build_object(
    'date',                (select day from d),
    'total_participants',  (select count(*) from public.participants),
    'total_winners',       (select count(*) from public.participants where is_correct),
    'prizes_redeemed',     (select count(*) from public.prize_codes where status = 'redeemed'),
    'prizes_pending',      (select count(*) from public.prize_codes where status = 'pending'),
    'today_participants',  (select count(*) from public.participants where assignment_date = (select day from d)),
    'today_winners',       (select count(*) from public.participants where assignment_date = (select day from d) and is_correct),
    'average_age',         (select round(avg(age)::numeric, 1) from public.participants),
    'age_brackets',        (select jsonb_agg(jsonb_build_object(
                               'label', b.label,
                               'count', c.n,
                               'percent', case when (select n from tot) = 0 then 0
                                               else round(c.n * 100 / (select n from tot), 1) end)
                             order by b.ord)
                           from brackets b
                           cross join lateral (select count(*)::numeric as n from public.participants p
                                                where p.age between b.lo and b.hi) c),
    'prizes_by_type',      (select coalesce(jsonb_object_agg(ps.prize_type, jsonb_build_object(
                               'label', ps.label,
                               'won', (select count(*) from public.prize_codes pc where pc.prize_type = ps.prize_type),
                               'redeemed', (select count(*) from public.prize_codes pc
                                             where pc.prize_type = ps.prize_type and pc.status = 'redeemed'))), '{}'::jsonb)
                           from public.prize_settings ps),
    'total_questions',     (select count(*) from public.questions),
    'active_questions',    (select count(*) from public.questions where is_active)
  );
$$;

-- Azzeramento delle statistiche (domande e foto dei premi restano).
-- p_keep_pending = true: conserva i vincitori con premio ancora da ritirare,
-- così i loro codici restano validi. Tutto in un'unica transazione.
create or replace function public.admin_reset_stats(p_keep_pending boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_participants integer;
  v_prizes       integer;
  v_entries      integer;
  v_kept         integer := 0;
begin
  -- Serializza con le assegnazioni in corso.
  perform pg_advisory_xact_lock(hashtext('quiz_reset'));

  if p_keep_pending then
    select count(*) into v_kept from public.prize_codes where status = 'pending';

    delete from public.prize_codes pc
     where pc.status <> 'pending';
    get diagnostics v_prizes = row_count;

    delete from public.participants p
     where not exists (select 1 from public.prize_codes pc
                        where pc.participant_id = p.id and pc.status = 'pending');
    get diagnostics v_participants = row_count;

    delete from public.entry_qr_codes e
     where e.participant_id is null
        or not exists (select 1 from public.participants p where p.id = e.participant_id);
    get diagnostics v_entries = row_count;
  else
    delete from public.prize_codes;
    get diagnostics v_prizes = row_count;
    delete from public.daily_question_assignments;
    delete from public.entry_qr_codes;
    get diagnostics v_entries = row_count;
    delete from public.participants;
    get diagnostics v_participants = row_count;
    -- Storico della versione precedente.
    delete from public.responses;
    delete from public.daily_questions;
  end if;

  return jsonb_build_object(
    'participants_deleted', v_participants,
    'prizes_deleted',       v_prizes,
    'entries_deleted',      v_entries,
    'pending_kept',         v_kept
  );
end;
$$;

create or replace function public.admin_list_prize_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.ord), '[]'::jsonb)
  from (
    select ps.prize_type, ps.label, ps.win_message, ps.image_path, ps.updated_at,
           case ps.prize_type when 'braccialetto' then 1 when 'cono' then 2 else 3 end as ord
    from public.prize_settings ps
  ) t;
$$;

-- Modifica nome e messaggio di vittoria di un premio.
-- La fascia d'età resta fissa: il premio è sempre deciso da prize_for_age().
create or replace function public.admin_update_prize(p_prize_type text, p_label text, p_win_message text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.prize_settings%rowtype;
begin
  update public.prize_settings
     set label = btrim(p_label),
         win_message = nullif(btrim(coalesce(p_win_message, '')), ''),
         updated_at = now()
   where prize_type = p_prize_type
  returning * into v_row;
  if not found then
    return null;
  end if;
  return to_jsonb(v_row);
end;
$$;

-- Imposta la nuova foto e restituisce il percorso precedente (da eliminare).
create or replace function public.admin_set_prize_image(p_prize_type text, p_image_path text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_old text;
begin
  select image_path into v_old from public.prize_settings where prize_type = p_prize_type for update;
  if not found then
    return null;
  end if;
  update public.prize_settings set image_path = p_image_path, updated_at = now() where prize_type = p_prize_type;
  return jsonb_build_object('previous_path', v_old, 'image_path', p_image_path);
end;
$$;

-- -----------------------------------------------------------------------------
--  Storage: bucket pubblico per le foto dei premi (solo su Supabase).
--  Lettura pubblica tramite URL; il caricamento avviene solo dal server.
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('prize-images', 'prize-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update
      set public = true,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
--  Permessi sulle funzioni: solo service_role
-- -----------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.set_updated_at()',
    'public.rome_today()',
    'public.prize_for_age(integer)',
    'public.generate_prize_code()',
    'public.assign_question(uuid, date)',
    'public.entry_status(text, uuid)',
    'public.redeem_entry(text, integer, date)',
    'public.get_participant_state(uuid)',
    'public.submit_participant_answer(uuid, text)',
    'public.cassa_create_entry(text, integer, text)',
    'public.cassa_entry_status(uuid)',
    'public.cassa_cancel_entry(uuid)',
    'public.normalize_prize_code(text)',
    'public.cassa_lookup_prize(text)',
    'public.cassa_redeem_prize(text, text)',
    'public.cassa_list_redemptions(integer)',
    'public.check_rate_limit(text, integer, integer)',
    'public.reset_rate_limit(text)',
    'public.admin_list_questions()',
    'public.admin_get_question(uuid)',
    'public.admin_create_question(text, text, text, text, text, text, boolean)',
    'public.admin_update_question(uuid, text, text, text, text, text, text, boolean)',
    'public.admin_set_question_active(uuid, boolean)',
    'public.admin_delete_question(uuid)',
    'public.admin_get_stats(date)',
    'public.admin_list_prize_settings()',
    'public.admin_set_prize_image(text, text)',
    'public.admin_reset_stats(boolean)',
    'public.admin_update_prize(text, text, text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
