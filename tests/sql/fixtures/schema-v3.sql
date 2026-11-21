-- =============================================================================
--  Il Quiz – Schema database Supabase (PostgreSQL)
-- -----------------------------------------------------------------------------
--  Eseguire l'intero file nel SQL Editor di Supabase (Dashboard → SQL Editor →
--  New query → incolla → Run). Lo script è idempotente: può essere rieseguito
--  e aggiorna un database creato con le versioni precedenti senza perdere le
--  domande già inserite (né le scorte dei premi, se già presenti).
--
--  Flusso (un solo dispositivo, usato dal personale con i clienti):
--   * "Le casette della fortuna": 1 domanda facile. Se la risposta è giusta il
--     cliente sceglie una delle 5 Case Ronald e il database estrae un premio
--     a caso tra quelli ancora disponibili (in proporzione alle scorte).
--   * "La sfida Big Mac": 3 domande (facile, media, difficile) di fila.
--     Tutte giuste = Big Mac.
--   * Le domande ruotano: si sceglie sempre tra quelle usate meno di recente,
--     così clienti vicini non ricevono la stessa domanda.
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

-- Difficoltà: 0 = facile, 1 = media, 2 = difficile.
-- Le domande delle versioni precedenti diventano "facili".
alter table public.questions add column if not exists difficulty smallint not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'questions_difficulty_range') then
    alter table public.questions
      add constraint questions_difficulty_range check (difficulty between 0 and 2);
  end if;
end;
$$;

create index if not exists questions_active_idx on public.questions (is_active);
create index if not exists questions_active_difficulty_idx on public.questions (is_active, difficulty);

-- -----------------------------------------------------------------------------
--  Premi (con scorte)
-- -----------------------------------------------------------------------------

-- pool 'casette': estratti a caso dopo la scelta della casetta, con scorte.
-- pool 'bigmac' : premio della sfida a tre domande (senza scorte).
create table if not exists public.prizes (
  key         text primary key check (key in (
                'braccialetto', 'hamburger', 'nuggets', 'patatine', 'cono', 'profumatore', 'gadget', 'bigmac')),
  pool        text not null check (pool in ('casette', 'bigmac')),
  label       text not null check (char_length(btrim(label)) between 1 and 40),
  win_message text check (win_message is null or char_length(btrim(win_message)) between 1 and 120),
  image_path  text,
  stock       integer check (stock is null or stock between 0 and 99999),
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now(),
  check ((pool = 'casette') = (stock is not null))
);

-- Scorte iniziali: inserite solo la prima volta (rieseguire lo script non le azzera).
insert into public.prizes (key, pool, label, stock, sort_order) values
  ('braccialetto', 'casette', 'Braccialetto',     55, 1),
  ('hamburger',    'casette', 'Hamburger',        10, 2),
  ('nuggets',      'casette', 'Nuggets',          10, 3),
  ('patatine',     'casette', 'Patatine piccole', 10, 4),
  ('cono',         'casette', 'Cono',             10, 5),
  ('profumatore',  'casette', 'Profumatore auto', 10, 6),
  ('gadget',       'casette', 'Gadget vario',     50, 7),
  ('bigmac',       'bigmac',  'Big Mac',        null, 8)
on conflict (key) do nothing;

-- Le foto già caricate nella versione precedente (braccialetto, cono) restano.
do $$
begin
  if to_regclass('public.prize_settings') is not null then
    update public.prizes p
       set image_path = ps.image_path
      from public.prize_settings ps
     where ps.prize_type = p.key
       and p.image_path is null
       and ps.image_path is not null;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
--  Partite
-- -----------------------------------------------------------------------------

-- Le cinque Case Ronald del "villaggio della solidarietà".
create or replace function public.is_valid_house(p_house text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_house in ('brescia', 'firenze', 'bologna', 'roma-palidoro', 'milano-niguarda');
$$;

create table if not exists public.games (
  id          uuid primary key default gen_random_uuid(),
  mode        text not null check (mode in ('casette', 'bigmac')),
  -- playing → (pick_house →) won | lost ; abandoned = "Nuovo cliente" a metà partita
  status      text not null default 'playing'
              check (status in ('playing', 'pick_house', 'won', 'lost', 'abandoned')),
  step        smallint not null default 1 check (step between 1 and 3),
  house       text check (house is null or public.is_valid_house(house)),
  prize_key   text references public.prizes (key),
  play_date   date not null,
  created_at  timestamptz not null default now(),
  finished_at timestamptz,
  check (mode = 'bigmac' or step = 1),
  check (prize_key is null or status = 'won'),
  check ((status in ('playing', 'pick_house')) = (finished_at is null))
);

create index if not exists games_date_idx on public.games (play_date);
create index if not exists games_status_idx on public.games (status);

-- Domande assegnate nelle partite. Restano anche dopo l'azzeramento delle
-- statistiche (game_id = null), così la rotazione delle domande continua.
create table if not exists public.game_questions (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid references public.games (id) on delete set null,
  step            smallint not null check (step between 1 and 3),
  difficulty      smallint not null check (difficulty between 0 and 2),
  question_id     uuid references public.questions (id) on delete set null,
  selected_answer char(1) check (selected_answer in ('A', 'B', 'C', 'D')),
  is_correct      boolean,
  assigned_at     timestamptz not null default clock_timestamp(),
  answered_at     timestamptz,
  unique (game_id, step),
  check ((selected_answer is null) = (is_correct is null))
);

create index if not exists game_questions_question_idx on public.game_questions (question_id, assigned_at desc);

-- Rate limiting persistente (login del personale).
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

drop trigger if exists prizes_set_updated_at on public.prizes;
create trigger prizes_set_updated_at
  before update on public.prizes
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
--  Row Level Security: attiva ovunque, nessuna policy = accesso negato
--  a anon/authenticated. La service_role bypassa RLS (solo lato server).
--  Sono incluse le tabelle delle versioni precedenti (QR, codici premio,
--  partecipanti…), che restano come storico ma non sono più usate.
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'questions', 'prizes', 'games', 'game_questions', 'rate_limits',
    'daily_questions', 'responses', 'prize_settings', 'participants',
    'entry_qr_codes', 'prize_codes', 'daily_question_assignments'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('alter table public.%I force row level security', t);
      execute format('revoke all on public.%I from public, anon, authenticated', t);
      execute format('grant all on public.%I to service_role', t);
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
--  Rimozione delle funzioni delle versioni precedenti (QR, cassa, età…)
-- -----------------------------------------------------------------------------

drop function if exists public.get_daily_question(date, uuid);
drop function if exists public.submit_answer(uuid, text, uuid, date);
drop function if exists public.pick_next_question(uuid);
drop function if exists public.prize_for_age(integer);
drop function if exists public.generate_prize_code();
drop function if exists public.assign_question(uuid, date);
drop function if exists public.entry_status(text, uuid);
drop function if exists public.redeem_entry(text, integer, date);
drop function if exists public.get_participant_state(uuid);
drop function if exists public.submit_participant_answer(uuid, text);
drop function if exists public.cassa_create_entry(text, integer, text);
drop function if exists public.cassa_entry_status(uuid);
drop function if exists public.cassa_cancel_entry(uuid);
drop function if exists public.normalize_prize_code(text);
drop function if exists public.cassa_lookup_prize(text);
drop function if exists public.cassa_redeem_prize(text, text);
drop function if exists public.cassa_list_redemptions(integer);
drop function if exists public.admin_create_question(text, text, text, text, text, text, boolean);
drop function if exists public.admin_update_question(uuid, text, text, text, text, text, text, boolean);
drop function if exists public.admin_reset_stats(boolean);
drop function if exists public.admin_list_prize_settings();
drop function if exists public.admin_update_prize(text, text, text);
drop function if exists public.admin_set_prize_image(text, text);

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

-- Numero di domande della partita: 1 per le casette, 3 per la sfida Big Mac.
create or replace function public.game_total_steps(p_mode text)
returns smallint
language sql
immutable
set search_path = public
as $$
  select (case p_mode when 'bigmac' then 3 else 1 end)::smallint;
$$;

-- Pezzi ancora disponibili per le casette.
create or replace function public.casette_stock_left()
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(sum(stock), 0)::int from public.prizes where pool = 'casette';
$$;

-- Disponibilità dei due giochi: 'ok' | 'no_questions' | 'no_stock'.
create or replace function public.game_availability()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'stock_left', public.casette_stock_left(),
    'casette', case
      when not exists (select 1 from public.questions where is_active and difficulty = 0) then 'no_questions'
      when public.casette_stock_left() = 0 then 'no_stock'
      else 'ok' end,
    'bigmac', case
      when (select count(distinct difficulty) from public.questions where is_active) < 3 then 'no_questions'
      else 'ok' end
  );
$$;

-- Assegna la domanda per un passo della partita.
-- Rotazione: tra le domande attive della difficoltà richiesta (mai una già
-- uscita nella stessa partita) si prende a caso una di quelle mai usate;
-- se sono già state usate tutte, una del terzo usato MENO DI RECENTE. Una domanda appena uscita non può quindi
-- ripresentarsi prima che ne siano uscite almeno i 2/3 delle altre.
-- Se per quella difficoltà non c'è nulla (es. disattivata a metà partita) si
-- usa qualsiasi altra domanda attiva. L'advisory lock serializza le assegnazioni.
create or replace function public.assign_game_question(p_game uuid, p_step smallint)
returns uuid
language plpgsql
volatile
set search_path = public
as $$
declare
  v_mode       text;
  v_difficulty smallint;
  v_pick       uuid;
begin
  perform pg_advisory_xact_lock(hashtext('quiz_assign'));

  select mode into v_mode from public.games where id = p_game;
  v_difficulty := case when v_mode = 'bigmac' then p_step - 1 else 0 end;

  for attempt in 1..2 loop
    with pool as (
      select q.id,
             (select max(gq.assigned_at) from public.game_questions gq where gq.question_id = q.id) as last_used
      from public.questions q
      where q.is_active
        and (attempt = 2 or q.difficulty = v_difficulty)
        and not exists (select 1 from public.game_questions g2
                         where g2.game_id = p_game and g2.question_id = q.id)
    ),
    ranked as (
      select id,
             last_used,
             row_number() over (order by last_used asc nulls first, random()) as rn,
             count(*) over () as n,
             count(*) filter (where last_used is null) over () as never_used
      from pool
    )
    select id into v_pick
    from ranked
    where (never_used > 0 and last_used is null)
       or (never_used = 0 and rn <= greatest(ceil(n / 3.0), 1))
    order by random()
    limit 1;

    exit when v_pick is not null;
  end loop;

  if v_pick is null then
    return null;
  end if;

  insert into public.game_questions (game_id, step, difficulty, question_id)
  values (p_game, p_step, v_difficulty, v_pick);
  return v_pick;
end;
$$;

-- -----------------------------------------------------------------------------
--  Partita: avvio, stato, risposta, casetta, nuovo cliente
-- -----------------------------------------------------------------------------

-- status: 'ok' (con game_id) | 'no_questions' | 'no_stock'
create or replace function public.start_game(p_mode text, p_date date default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_avail jsonb;
  v_game  uuid;
begin
  if p_mode is null or p_mode not in ('casette', 'bigmac') then
    raise exception 'invalid_mode' using errcode = '22023';
  end if;

  v_avail := public.game_availability();
  if v_avail->>p_mode <> 'ok' then
    return jsonb_build_object('status', v_avail->>p_mode);
  end if;

  insert into public.games (mode, play_date)
  values (p_mode, coalesce(p_date, public.rome_today()))
  returning id into v_game;

  if public.assign_game_question(v_game, 1::smallint) is null then
    delete from public.games where id = v_game;
    return jsonb_build_object('status', 'no_questions');
  end if;

  return jsonb_build_object('status', 'ok', 'game_id', v_game);
end;
$$;

-- Stato della partita (mai la risposta corretta).
create or replace function public.get_game_state(p_game uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'game_id',       g.id,
    'mode',          g.mode,
    'status',        g.status,
    'step',          g.step,
    'total_steps',   public.game_total_steps(g.mode),
    'correct_count', (select count(*) from public.game_questions gq where gq.game_id = g.id and gq.is_correct),
    'house',         g.house,
    'question',      case when g.status <> 'playing' or q.id is null then null else jsonb_build_object(
                       'id', q.id,
                       'question_text', q.question_text,
                       'answer_a', q.answer_a,
                       'answer_b', q.answer_b,
                       'answer_c', q.answer_c,
                       'answer_d', q.answer_d,
                       'difficulty', cur.difficulty) end,
    'prize',         case when p.key is null then null else jsonb_build_object(
                       'key', p.key,
                       'label', p.label,
                       'win_message', p.win_message,
                       'image_path', p.image_path) end
  )
  from public.games g
  left join public.game_questions cur on cur.game_id = g.id and cur.step = g.step
  left join public.questions q on q.id = cur.question_id
  left join public.prizes p on p.key = g.prize_key
  where g.id = p_game;
$$;

-- Verifica della risposta al passo corrente.
-- status: 'ok' (con correct) | 'not_playing' | 'no_question' | 'not_found'
create or replace function public.submit_game_answer(p_game uuid, p_answer text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_answer  text := upper(btrim(coalesce(p_answer, '')));
  v_g       public.games%rowtype;
  v_gq      public.game_questions%rowtype;
  v_correct char(1);
  v_ok      boolean;
begin
  if v_answer not in ('A', 'B', 'C', 'D') then
    raise exception 'invalid_answer' using errcode = '22023';
  end if;

  -- Lock della partita: due invii simultanei (doppio tocco) vengono serializzati.
  select * into v_g from public.games where id = p_game for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_g.status <> 'playing' then
    return jsonb_build_object('status', 'not_playing');
  end if;

  select * into v_gq from public.game_questions where game_id = p_game and step = v_g.step;
  if found then
    select q.correct_answer into v_correct from public.questions q where q.id = v_gq.question_id;
  end if;
  if v_gq.id is null or v_correct is null or v_gq.selected_answer is not null then
    -- Domanda eliminata nel frattempo: la partita non può continuare.
    update public.games set status = 'abandoned', finished_at = now() where id = p_game;
    return jsonb_build_object('status', 'no_question');
  end if;

  v_ok := (v_correct = v_answer);
  update public.game_questions
     set selected_answer = v_answer, is_correct = v_ok, answered_at = now()
   where id = v_gq.id;

  if not v_ok then
    update public.games set status = 'lost', finished_at = now() where id = p_game;
  elsif v_g.mode = 'casette' then
    if public.casette_stock_left() > 0 then
      update public.games set status = 'pick_house' where id = p_game;
    else
      -- Premi esauriti: risposta giusta ma niente da estrarre.
      update public.games set status = 'won', finished_at = now() where id = p_game;
    end if;
  elsif v_g.step < public.game_total_steps(v_g.mode) then
    update public.games set step = step + 1 where id = p_game;
    if public.assign_game_question(p_game, (v_g.step + 1)::smallint) is null then
      update public.games set status = 'abandoned', finished_at = now() where id = p_game;
      return jsonb_build_object('status', 'no_question');
    end if;
  else
    update public.games set status = 'won', prize_key = 'bigmac', finished_at = now() where id = p_game;
  end if;

  return jsonb_build_object('status', 'ok', 'correct', v_ok);
end;
$$;

-- Scelta della casetta: estrazione casuale del premio in proporzione alle
-- scorte rimaste, con scalo atomico della scorta (lock sulle righe dei premi).
-- status: 'ok' | 'not_allowed' | 'not_found'
create or replace function public.pick_house(p_game uuid, p_house text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_g     public.games%rowtype;
  v_total integer;
  v_r     integer;
  v_key   text;
begin
  if p_house is null or not public.is_valid_house(p_house) then
    raise exception 'invalid_house' using errcode = '22023';
  end if;

  select * into v_g from public.games where id = p_game for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_g.status <> 'pick_house' then
    return jsonb_build_object('status', 'not_allowed');
  end if;

  perform 1 from public.prizes where pool = 'casette' for update;
  v_total := public.casette_stock_left();

  if v_total > 0 then
    v_r := floor(random() * v_total)::int; -- 0 .. v_total - 1
    select t.key into v_key
    from (
      select key, sum(stock) over (order by sort_order, key) as cum
      from public.prizes
      where pool = 'casette' and stock > 0
    ) t
    where t.cum > v_r
    order by t.cum
    limit 1;

    update public.prizes set stock = stock - 1 where key = v_key;
  end if;

  update public.games
     set status = 'won', house = p_house, prize_key = v_key, finished_at = now()
   where id = p_game;

  return jsonb_build_object('status', 'ok', 'prize_key', v_key);
end;
$$;

-- "Nuovo cliente" a partita non conclusa.
create or replace function public.abandon_game(p_game uuid)
returns jsonb
language sql
volatile
security definer
set search_path = public
as $$
  with u as (
    update public.games set status = 'abandoned', finished_at = now()
     where id = p_game and status in ('playing', 'pick_house')
    returning 1
  )
  select jsonb_build_object('abandoned', (select count(*) from u) > 0);
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
--  Amministrazione: domande
-- -----------------------------------------------------------------------------

create or replace function public.admin_list_questions()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.difficulty, t.created_at desc), '[]'::jsonb)
  from (
    select q.id, q.question_text, q.answer_a, q.answer_b, q.answer_c, q.answer_d,
           q.correct_answer, q.difficulty, q.is_active, q.created_at, q.updated_at,
           (select (max(gq.assigned_at) at time zone 'Europe/Rome')::date
              from public.game_questions gq where gq.question_id = q.id) as last_used_date,
           (select count(*) from public.game_questions gq where gq.question_id = q.id)::int as times_used
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
  p_difficulty     integer,
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
  insert into public.questions (question_text, answer_a, answer_b, answer_c, answer_d, correct_answer, difficulty, is_active)
  values (btrim(p_question_text), btrim(p_answer_a), btrim(p_answer_b), btrim(p_answer_c), btrim(p_answer_d),
          upper(btrim(p_correct_answer)), coalesce(p_difficulty, 0), coalesce(p_is_active, true))
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
  p_difficulty     integer,
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
         difficulty     = coalesce(p_difficulty, difficulty),
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

-- -----------------------------------------------------------------------------
--  Amministrazione: statistiche
-- -----------------------------------------------------------------------------

create or replace function public.admin_get_stats(p_date date default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with d as (select coalesce(p_date, public.rome_today()) as day),
  per_mode as (
    select m.mode,
           jsonb_build_object(
             'played',      count(g.id) filter (where g.status <> 'abandoned'),
             'won',         count(g.id) filter (where g.status = 'won'),
             'lost',        count(g.id) filter (where g.status = 'lost'),
             'today_played', count(g.id) filter (where g.status <> 'abandoned' and g.play_date = (select day from d)),
             'today_won',   count(g.id) filter (where g.status = 'won' and g.play_date = (select day from d))
           ) as v
    from (values ('casette'), ('bigmac')) m(mode)
    left join public.games g on g.mode = m.mode
    group by m.mode
  )
  select jsonb_build_object(
    'date',          (select day from d),
    'casette',       (select v from per_mode where mode = 'casette'),
    'bigmac',        (select v from per_mode where mode = 'bigmac'),
    'abandoned',     (select count(*) from public.games where status = 'abandoned'),
    'stock_left',    public.casette_stock_left(),
    'prizes',        (select coalesce(jsonb_agg(jsonb_build_object(
                        'key', p.key,
                        'pool', p.pool,
                        'label', p.label,
                        'stock', p.stock,
                        'won', (select count(*) from public.games g where g.prize_key = p.key),
                        'won_today', (select count(*) from public.games g
                                       where g.prize_key = p.key and g.play_date = (select day from d)))
                      order by p.sort_order), '[]'::jsonb)
                      from public.prizes p),
    'total_questions',  (select count(*) from public.questions),
    'active_by_difficulty', (select jsonb_agg(
                               (select count(*) from public.questions q where q.is_active and q.difficulty = lvl)
                               order by lvl)
                             from generate_series(0, 2) lvl)
  );
$$;

-- Azzeramento delle statistiche: elimina tutte le partite.
-- Domande, premi, foto e scorte restano; resta anche lo storico delle domande
-- uscite, così la rotazione continua senza ripetizioni.
create or replace function public.admin_reset_stats()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_games integer;
begin
  perform pg_advisory_xact_lock(hashtext('quiz_assign'));
  delete from public.games;
  get diagnostics v_games = row_count;
  return jsonb_build_object('games_deleted', v_games);
end;
$$;

-- -----------------------------------------------------------------------------
--  Amministrazione: premi
-- -----------------------------------------------------------------------------

create or replace function public.admin_list_prizes()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'key', p.key, 'pool', p.pool, 'label', p.label, 'win_message', p.win_message,
           'image_path', p.image_path, 'stock', p.stock, 'updated_at', p.updated_at)
         order by p.sort_order), '[]'::jsonb)
  from public.prizes p;
$$;

-- Modifica nome, messaggio di vittoria e (solo casette) pezzi disponibili.
-- p_stock null = scorta invariata.
create or replace function public.admin_update_prize(p_key text, p_label text, p_win_message text, p_stock integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.prizes%rowtype;
begin
  update public.prizes
     set label = btrim(p_label),
         win_message = nullif(btrim(coalesce(p_win_message, '')), ''),
         stock = case when pool = 'casette' then coalesce(p_stock, stock) else null end
   where key = p_key
  returning * into v_row;
  if not found then
    return null;
  end if;
  return to_jsonb(v_row);
end;
$$;

-- Imposta la nuova foto e restituisce il percorso precedente (da eliminare).
create or replace function public.admin_set_prize_image(p_key text, p_image_path text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_old text;
begin
  select image_path into v_old from public.prizes where key = p_key for update;
  if not found then
    return null;
  end if;
  update public.prizes set image_path = p_image_path where key = p_key;
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
    'public.is_valid_house(text)',
    'public.game_total_steps(text)',
    'public.casette_stock_left()',
    'public.game_availability()',
    'public.assign_game_question(uuid, smallint)',
    'public.start_game(text, date)',
    'public.get_game_state(uuid)',
    'public.submit_game_answer(uuid, text)',
    'public.pick_house(uuid, text)',
    'public.abandon_game(uuid)',
    'public.check_rate_limit(text, integer, integer)',
    'public.reset_rate_limit(text)',
    'public.admin_list_questions()',
    'public.admin_get_question(uuid)',
    'public.admin_create_question(text, text, text, text, text, text, integer, boolean)',
    'public.admin_update_question(uuid, text, text, text, text, text, text, integer, boolean)',
    'public.admin_set_question_active(uuid, boolean)',
    'public.admin_delete_question(uuid)',
    'public.admin_get_stats(date)',
    'public.admin_reset_stats()',
    'public.admin_list_prizes()',
    'public.admin_update_prize(text, text, text, integer)',
    'public.admin_set_prize_image(text, text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
