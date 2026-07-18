-- ToonTalk initial schema (PRD §5.3, §6.3)
-- Tables: families, children, units, activities, attempts, skill_mastery, rewards, streaks
-- Plus: mastery + streak update functions, RLS policies.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- families: one row per parent auth user
-- ---------------------------------------------------------------------------
create table public.families (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null unique references auth.users (id) on delete cascade,
  parent_language text not null default 'ta' check (parent_language in ('ta', 'en')),
  consent_given_at timestamptz,          -- verifiable parental consent (NFR-4)
  camera_consent_at timestamptz,         -- separate, revocable camera consent
  subscription_status text not null default 'free'
    check (subscription_status in ('free', 'active', 'past_due', 'canceled')),
  weekly_summary_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- children: profile only — nickname + birth-year band, no DOB, no photos (NFR-3)
-- ---------------------------------------------------------------------------
create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 30),
  avatar text not null default 'kutti',
  birth_year_band text not null check (birth_year_band in ('4-5', '6-7')),
  daily_limit_minutes int not null default 20 check (daily_limit_minutes between 5 and 120),
  camera_enabled boolean not null default true,   -- FR-6.6 parent toggle
  hold_level_a boolean not null default false,    -- FR-6.6 language pace: auto / hold at A
  created_at timestamptz not null default now()
);

create index children_family_idx on public.children (family_id);

-- FR-6.5: max 4 child profiles per family
create function public.enforce_max_children()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.children where family_id = new.family_id) >= 4 then
    raise exception 'A family can have at most 4 child profiles';
  end if;
  return new;
end;
$$;

create trigger children_max_four
  before insert on public.children
  for each row execute function public.enforce_max_children();

-- ---------------------------------------------------------------------------
-- curriculum: units + activities (public-read; content is data, not code)
-- ---------------------------------------------------------------------------
create table public.units (
  id int primary key,
  slug text not null unique,
  title_en text not null,
  title_ta text not null,
  position int not null unique,
  is_free boolean not null default false          -- §7: units 1–2 free forever
);

create table public.activities (
  id text primary key,                            -- stable content id, e.g. 'u1-a03'
  unit_id int not null references public.units (id) on delete cascade,
  position int not null,
  activity_type text not null check (activity_type in
    ('tap_answer', 'show_fingers', 'find_color', 'count_show', 'say_it_back')),
  skill text not null,                            -- e.g. 'color.red', 'number.3'
  spec jsonb not null,                            -- full activity spec (see content/schema)
  updated_at timestamptz not null default now(),
  unique (unit_id, position)
);

create index activities_skill_idx on public.activities (skill);

-- ---------------------------------------------------------------------------
-- attempts: raw feed for mastery + parent dashboard (§6.2)
-- id is client-generated so offline sync is idempotent (NFR-2)
-- ---------------------------------------------------------------------------
create table public.attempts (
  id uuid primary key,                            -- generated on device
  child_id uuid not null references public.children (id) on delete cascade,
  activity_id text not null references public.activities (id),
  skill text not null,
  tries smallint not null check (tries between 1 and 3),
  stars smallint not null check (stars between 0 and 3),
  outcome text not null check (outcome in ('success', 'helped', 'skipped')),
  validation_source text not null check (validation_source in ('device', 'cloud', 'tap')),
  duration_ms int check (duration_ms >= 0),
  client_created_at timestamptz not null,
  synced_at timestamptz not null default now()
);

create index attempts_child_time_idx on public.attempts (child_id, client_created_at desc);
create index attempts_child_skill_idx on public.attempts (child_id, skill, client_created_at desc);

-- ---------------------------------------------------------------------------
-- skill_mastery: rolling state per (child, skill), updated by trigger (§6.3)
-- ---------------------------------------------------------------------------
create table public.skill_mastery (
  child_id uuid not null references public.children (id) on delete cascade,
  skill text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'learning', 'mastered')),
  language_level text not null default 'A' check (language_level in ('A', 'B', 'C')),
  rolling_accuracy numeric(4, 3),                 -- first-try accuracy over last 10 attempts
  consecutive_misses int not null default 0,
  last_attempt_at timestamptz,
  mastered_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (child_id, skill)
);

-- ---------------------------------------------------------------------------
-- rewards: sticker album (FR-4.3)
-- ---------------------------------------------------------------------------
create table public.rewards (
  child_id uuid not null references public.children (id) on delete cascade,
  reward_type text not null check (reward_type in ('sticker', 'outfit', 'background')),
  reward_id text not null,
  earned_at timestamptz not null default now(),
  primary key (child_id, reward_type, reward_id)
);

-- ---------------------------------------------------------------------------
-- streaks: daily streak, pauses but never resets (FR-4.2)
-- ---------------------------------------------------------------------------
create table public.streaks (
  child_id uuid primary key references public.children (id) on delete cascade,
  current int not null default 0,
  longest int not null default 0,
  last_active_date date,
  paused_at date
);

-- ---------------------------------------------------------------------------
-- Mastery + streak maintenance on attempt insert (§6.3, FR-4.2)
--   mastered  : ≥ 80% first-try accuracy over last 10 attempts (min 5 attempts)
--   level     : A→B→C advances on reaching mastery; steps back after 3 consecutive misses
--   streak    : +1 if active yesterday, unchanged if already counted today,
--               otherwise paused (kept, not reset) and restarted from current+1
-- ---------------------------------------------------------------------------
create function public.on_attempt_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_first_try_acc numeric;
  v_n int;
  v_row skill_mastery%rowtype;
  v_new_level text;
  v_new_status text;
  v_misses int;
  v_streak streaks%rowtype;
  v_today date := (new.client_created_at at time zone 'Asia/Kolkata')::date;
begin
  -- rolling first-try accuracy over the last 10 attempts for this skill
  select count(*), avg(case when tries = 1 and outcome = 'success' then 1.0 else 0.0 end)
    into v_n, v_first_try_acc
  from (
    select tries, outcome
    from attempts
    where child_id = new.child_id and skill = new.skill
    order by client_created_at desc
    limit 10
  ) recent;

  select * into v_row from skill_mastery
    where child_id = new.child_id and skill = new.skill;

  if not found then
    v_row.language_level := 'A';
    v_row.status := 'not_started';
    v_row.consecutive_misses := 0;
    v_row.mastered_at := null;
  end if;

  if new.outcome = 'success' and new.tries = 1 then
    v_misses := 0;
  else
    v_misses := v_row.consecutive_misses + 1;
  end if;

  v_new_status := case
    when v_n >= 5 and v_first_try_acc >= 0.8 then 'mastered'
    else 'learning'
  end;

  v_new_level := v_row.language_level;
  if v_new_status = 'mastered' and v_row.status is distinct from 'mastered' then
    v_new_level := case v_row.language_level when 'A' then 'B' when 'B' then 'C' else 'C' end;
  elsif v_misses >= 3 then
    v_new_level := case v_row.language_level when 'C' then 'B' else 'A' end;
    v_misses := 0;  -- reset counter after stepping back
  end if;

  insert into skill_mastery as sm
    (child_id, skill, status, language_level, rolling_accuracy,
     consecutive_misses, last_attempt_at, mastered_at, updated_at)
  values
    (new.child_id, new.skill, v_new_status, v_new_level, v_first_try_acc,
     v_misses, new.client_created_at,
     case when v_new_status = 'mastered' and v_row.mastered_at is null
          then new.client_created_at else v_row.mastered_at end,
     now())
  on conflict (child_id, skill) do update set
    status = excluded.status,
    language_level = excluded.language_level,
    rolling_accuracy = excluded.rolling_accuracy,
    consecutive_misses = excluded.consecutive_misses,
    last_attempt_at = excluded.last_attempt_at,
    mastered_at = excluded.mastered_at,
    updated_at = excluded.updated_at;

  -- streak
  select * into v_streak from streaks where child_id = new.child_id;
  if not found then
    insert into streaks (child_id, current, longest, last_active_date)
    values (new.child_id, 1, 1, v_today);
  elsif v_streak.last_active_date is null or v_streak.last_active_date < v_today then
    update streaks set
      current = case
        when v_streak.last_active_date = v_today - 1 then v_streak.current + 1
        else v_streak.current + 1  -- paused, never reset: resume counting
      end,
      longest = greatest(longest, case
        when v_streak.last_active_date = v_today - 1 then v_streak.current + 1
        else v_streak.current + 1 end),
      last_active_date = v_today,
      paused_at = case when v_streak.last_active_date < v_today - 1
                       and v_streak.last_active_date is not null
                  then v_streak.last_active_date else null end
    where child_id = new.child_id;
  end if;

  return new;
end;
$$;

create trigger attempts_after_insert
  after insert on public.attempts
  for each row execute function public.on_attempt_insert();

-- ---------------------------------------------------------------------------
-- RLS: parents read/write only their own family's rows; curriculum public-read
-- (Per-child scoped tokens are a later hardening step; v1 child app runs
--  under the parent's session on the shared device.)
-- ---------------------------------------------------------------------------
alter table public.families enable row level security;
alter table public.children enable row level security;
alter table public.units enable row level security;
alter table public.activities enable row level security;
alter table public.attempts enable row level security;
alter table public.skill_mastery enable row level security;
alter table public.rewards enable row level security;
alter table public.streaks enable row level security;

create function public.my_family_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from families where parent_user_id = auth.uid();
$$;

create function public.is_my_child(p_child_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from children c
    join families f on f.id = c.family_id
    where c.id = p_child_id and f.parent_user_id = auth.uid()
  );
$$;

create policy families_own on public.families
  for all using (parent_user_id = auth.uid()) with check (parent_user_id = auth.uid());

create policy children_own on public.children
  for all using (family_id = public.my_family_id())
  with check (family_id = public.my_family_id());

create policy units_read on public.units for select using (true);
create policy activities_read on public.activities for select using (true);

create policy attempts_own on public.attempts
  for all using (public.is_my_child(child_id)) with check (public.is_my_child(child_id));

create policy skill_mastery_own_read on public.skill_mastery
  for select using (public.is_my_child(child_id));

create policy rewards_own on public.rewards
  for all using (public.is_my_child(child_id)) with check (public.is_my_child(child_id));

create policy streaks_own_read on public.streaks
  for select using (public.is_my_child(child_id));
