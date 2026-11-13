-- =============================================================================
--  Il Quiz del Giorno – Schema database Supabase (PostgreSQL)
-- -----------------------------------------------------------------------------
--  Eseguire l'intero file nel SQL Editor di Supabase (Dashboard → SQL Editor →
--  New query → incolla → Run). Lo script è idempotente: può essere rieseguito.
--
--  Principi di sicurezza:
--   * RLS attivo su tutte le tabelle, nessuna policy pubblica: le chiavi
--     "anon" / "authenticated" non possono leggere né modificare nulla.
--   * Tutto l'accesso avviene dal server Next.js con la SERVICE_ROLE_KEY,
--     esclusivamente tramite le funzioni qui sotto.
--   * La risposta corretta non esce mai dal database: submit_answer
--     restituisce solo un booleano.
-- =============================================================================

-- gen_random_uuid() è nativa da PostgreSQL 13 (nessuna estensione necessaria).

-- -----------------------------------------------------------------------------
--  Tabelle
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

-- Una sola domanda per ogni data italiana (vincolo UNIQUE su question_date).
create table if not exists public.daily_questions (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references public.questions (id) on delete cascade,
  question_date date not null unique,
  created_at    timestamptz not null default now()
);

create index if not exists daily_questions_question_idx on public.daily_questions (question_id);

-- Risposte dei partecipanti (anonime). participant_id è un identificativo
-- casuale salvato in un cookie httpOnly: impedisce di rispondere due volte.
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

create index if not exists responses_date_idx on public.responses (question_date);

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

alter table public.questions       enable row level security;
alter table public.daily_questions enable row level security;
alter table public.responses       enable row level security;
alter table public.rate_limits     enable row level security;

alter table public.questions       force row level security;
alter table public.daily_questions force row level security;
alter table public.responses       force row level security;
alter table public.rate_limits     force row level security;

revoke all on public.questions, public.daily_questions, public.responses, public.rate_limits
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
--  Utility interne
-- -----------------------------------------------------------------------------

-- Data corrente nel fuso orario Europe/Rome (fonte di verità lato DB).
create or replace function public.rome_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Europe/Rome')::date;
$$;

-- Sceglie la prossima domanda: prima quelle mai usate, poi quelle usate
-- meno di recente; a parità, casuale. Così si ruota su tutte le domande.
create or replace function public.pick_next_question(p_exclude uuid default null)
returns uuid
language sql
volatile
set search_path = public
as $$
  select q.id
  from public.questions q
  left join (
    select question_id, max(question_date) as last_used
    from public.daily_questions
    group by question_id
  ) u on u.question_id = q.id
  where q.is_active
    and (p_exclude is null or q.id <> p_exclude)
  order by u.last_used asc nulls first, random()
  limit 1;
$$;

-- -----------------------------------------------------------------------------
--  API pubblica (chiamata solo dal server): domanda del giorno
--  Restituisce la domanda SENZA la risposta corretta. Se p_participant ha già
--  risposto oggi, include l'esito già registrato.
-- -----------------------------------------------------------------------------

create or replace function public.get_daily_question(
  p_date        date default null,
  p_participant uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_date      date := coalesce(p_date, public.rome_today());
  v_qid       uuid;
  v_active    boolean;
  v_new       uuid;
  v_result    jsonb;
  v_prev      public.responses%rowtype;
begin
  -- Percorso veloce: domanda già assegnata e attiva.
  select dq.question_id, q.is_active
    into v_qid, v_active
  from public.daily_questions dq
  join public.questions q on q.id = dq.question_id
  where dq.question_date = v_date;

  if v_qid is null or not v_active then
    -- Percorso lento: serializza l'assegnazione per questa data.
    perform pg_advisory_xact_lock(hashtext('quiz_daily:' || v_date::text));

    select dq.question_id, q.is_active
      into v_qid, v_active
    from public.daily_questions dq
    join public.questions q on q.id = dq.question_id
    where dq.question_date = v_date;

    if v_qid is null then
      v_new := public.pick_next_question(null);
      if v_new is null then
        return null; -- nessuna domanda disponibile
      end if;
      insert into public.daily_questions (question_id, question_date)
      values (v_new, v_date)
      on conflict (question_date) do nothing;
    elsif not v_active then
      -- La domanda del giorno è stata disattivata: la si sostituisce.
      v_new := public.pick_next_question(v_qid);
      if v_new is null then
        delete from public.daily_questions where question_date = v_date;
        return null;
      end if;
      update public.daily_questions
         set question_id = v_new, created_at = now()
       where question_date = v_date;
    end if;

    select dq.question_id into v_qid
    from public.daily_questions dq
    where dq.question_date = v_date;
  end if;

  select jsonb_build_object(
           'id',            q.id,
           'question_text', q.question_text,
           'answer_a',      q.answer_a,
           'answer_b',      q.answer_b,
           'answer_c',      q.answer_c,
           'answer_d',      q.answer_d,
           'question_date', v_date
         )
    into v_result
  from public.questions q
  where q.id = v_qid;

  if v_result is null then
    return null;
  end if;

  if p_participant is not null then
    select * into v_prev
    from public.responses r
    where r.question_date = v_date and r.participant_id = p_participant;

    if found then
      v_result := v_result || jsonb_build_object(
        'already_answered', true,
        'was_correct', v_prev.is_correct
      );
    end if;
  end if;

  return v_result || jsonb_build_object('already_answered', coalesce((v_result->>'already_answered')::boolean, false));
end;
$$;

-- -----------------------------------------------------------------------------
--  API pubblica (chiamata solo dal server): verifica della risposta
--  status: 'ok' | 'already_answered' | 'stale' | 'no_question'
--  Restituisce SOLO un booleano "correct", mai la risposta giusta.
-- -----------------------------------------------------------------------------

create or replace function public.submit_answer(
  p_question_id uuid,
  p_answer      text,
  p_participant uuid,
  p_date        date default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_date     date := coalesce(p_date, public.rome_today());
  v_answer   text := upper(btrim(coalesce(p_answer, '')));
  v_today    uuid;
  v_correct  char(1);
  v_is_ok    boolean;
  v_prev     public.responses%rowtype;
begin
  if v_answer not in ('A', 'B', 'C', 'D') then
    raise exception 'invalid_answer' using errcode = '22023';
  end if;

  select dq.question_id into v_today
  from public.daily_questions dq
  join public.questions q on q.id = dq.question_id and q.is_active
  where dq.question_date = v_date;

  if v_today is null then
    return jsonb_build_object('status', 'no_question');
  end if;

  if v_today <> p_question_id then
    return jsonb_build_object('status', 'stale');
  end if;

  select * into v_prev
  from public.responses r
  where r.question_date = v_date and r.participant_id = p_participant;

  if found then
    return jsonb_build_object('status', 'already_answered', 'correct', v_prev.is_correct);
  end if;

  select q.correct_answer into v_correct from public.questions q where q.id = v_today;
  v_is_ok := (v_correct = v_answer);

  begin
    insert into public.responses (question_id, question_date, participant_id, selected_answer, is_correct)
    values (v_today, v_date, p_participant, v_answer, v_is_ok);
  exception when unique_violation then
    -- Richiesta duplicata concorrente: si restituisce l'esito già salvato.
    select * into v_prev
    from public.responses r
    where r.question_date = v_date and r.participant_id = p_participant;
    return jsonb_build_object('status', 'already_answered', 'correct', v_prev.is_correct);
  end;

  return jsonb_build_object('status', 'ok', 'correct', v_is_ok);
end;
$$;

-- -----------------------------------------------------------------------------
--  Rate limiting atomico a finestra fissa.
--  Restituisce jsonb {allowed: bool, remaining: int, retry_after: int(sec)}
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

  -- Pulizia occasionale delle chiavi scadute.
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
--  API amministrative (chiamate solo dal server dopo verifica della sessione)
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
           (select max(dq.question_date) from public.daily_questions dq where dq.question_id = q.id) as last_used_date,
           (select count(*) from public.daily_questions dq where dq.question_id = q.id)::int as times_used
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

create or replace function public.admin_get_stats(p_date date default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with d as (select coalesce(p_date, public.rome_today()) as day)
  select jsonb_build_object(
    'date',              (select day from d),
    'total_questions',   (select count(*) from public.questions),
    'active_questions',  (select count(*) from public.questions where is_active),
    'never_used_active', (select count(*) from public.questions q
                           where q.is_active
                             and not exists (select 1 from public.daily_questions dq where dq.question_id = q.id)),
    'today_question',    (select jsonb_build_object('id', q.id, 'question_text', q.question_text,
                                                     'correct_answer', q.correct_answer, 'is_active', q.is_active)
                            from public.daily_questions dq
                            join public.questions q on q.id = dq.question_id
                           where dq.question_date = (select day from d)),
    'today_participants', (select count(*) from public.responses r where r.question_date = (select day from d)),
    'today_winners',      (select count(*) from public.responses r where r.question_date = (select day from d) and r.is_correct)
  );
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
    'public.pick_next_question(uuid)',
    'public.get_daily_question(date, uuid)',
    'public.submit_answer(uuid, text, uuid, date)',
    'public.check_rate_limit(text, integer, integer)',
    'public.reset_rate_limit(text)',
    'public.admin_list_questions()',
    'public.admin_get_question(uuid)',
    'public.admin_create_question(text, text, text, text, text, text, boolean)',
    'public.admin_update_question(uuid, text, text, text, text, text, text, boolean)',
    'public.admin_set_question_active(uuid, boolean)',
    'public.admin_delete_question(uuid)',
    'public.admin_get_stats(date)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;

grant all on public.questions, public.daily_questions, public.responses, public.rate_limits to service_role;
