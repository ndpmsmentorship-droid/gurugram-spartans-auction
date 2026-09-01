-- ============================================================
-- SDLL Season 2 — match schedule portal
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
--
-- Adds two tables:
--   schedule_config  one row per season — the inputs the generator ran with,
--                    kept so a regenerate reproduces or tweaks the same run
--   fixtures         the generated match list, plus results as they come in
--
-- Safe to re-run: everything is `if not exists` / `drop policy if exists`.
-- Regenerating the schedule deletes and reinserts this season's fixtures, so
-- any results already entered for it are lost — the admin UI warns first.
-- ============================================================

create table if not exists schedule_config (
  season_id       uuid primary key references seasons(id) on delete cascade,
  start_date      date        not null,
  match_days      text[]      not null default '{Saturday,Sunday}',
  slots           text[]      not null default '{08:00,12:00,16:00}',
  blackout_dates  date[]      not null default '{}',
  venue           text        not null default 'Sportscube, Gurugram',
  seed            int         not null default 7,
  generated_at    timestamptz,
  updated_at      timestamptz not null default now()
);

create table if not exists fixtures (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references seasons(id) on delete cascade,
  match_no       int  not null,
  stage          text not null default 'group'
                   check (stage in ('group', 'semi', 'third', 'final')),
  -- weekend number, 1-based; knockouts carry the finals weekend
  round          int  not null,
  match_date     date not null,
  day_name       text not null,
  slot           text not null,               -- '08:00', 24h
  group_name     text,                        -- null for knockouts
  home_team_id   uuid references teams(id) on delete set null,
  away_team_id   uuid references teams(id) on delete set null,
  -- knockout placeholders ("Winner Group A") until the bracket resolves
  home_label     text,
  away_label     text,
  venue          text,

  -- results
  status         text not null default 'scheduled'
                   check (status in ('scheduled', 'completed', 'no_result', 'abandoned')),
  home_score     text,
  away_score     text,
  winner_team_id uuid references teams(id) on delete set null,
  result_note    text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (season_id, match_no)
);

create index if not exists fixtures_season_date_idx
  on fixtures (season_id, match_date, slot);
create index if not exists fixtures_season_round_idx
  on fixtures (season_id, round);

-- ---- RLS -------------------------------------------------------------------
-- The schedule is public: unlike the auction pool, fixtures are the one thing
-- players, owners and sponsors all need to see without signing in. Writes stay
-- admin-only via the existing is_admin() helper from schema.sql.

alter table schedule_config enable row level security;
alter table fixtures        enable row level security;

drop policy if exists "schedule_config_select" on schedule_config;
create policy "schedule_config_select" on schedule_config
  for select using (true);

drop policy if exists "schedule_config_write" on schedule_config;
create policy "schedule_config_write" on schedule_config
  for all using (is_admin()) with check (is_admin());

drop policy if exists "fixtures_select" on fixtures;
create policy "fixtures_select" on fixtures
  for select using (true);

drop policy if exists "fixtures_write" on fixtures;
create policy "fixtures_write" on fixtures
  for all using (is_admin()) with check (is_admin());

-- ---- keep updated_at honest ------------------------------------------------
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fixtures_touch on fixtures;
create trigger fixtures_touch before update on fixtures
  for each row execute function touch_updated_at();

drop trigger if exists schedule_config_touch on schedule_config;
create trigger schedule_config_touch before update on schedule_config
  for each row execute function touch_updated_at();
