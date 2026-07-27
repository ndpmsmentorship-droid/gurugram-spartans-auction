-- Gurugram Spartans — Auction-Day Scout tool schema (2026-07-23 pivot)
-- Run once in the Supabase SQL Editor. Idempotent-ish (drops/recreates policies).
-- Independent of the older auction tables (which remain but are unlinked from the UI).

create extension if not exists "pgcrypto";

create table if not exists scout_players (
  id uuid primary key default gen_random_uuid(),

  -- identity (PII columns are nullable and never rendered to the client)
  full_name text not null,
  age int,
  primary_role text,
  photo_url text,
  cricheroes_link text,
  email text,
  phone text,

  -- batting (raw)
  bat_matches numeric,
  bat_innings numeric,
  not_out numeric,
  runs numeric,
  highest_score text,
  bat_avg numeric,
  bat_sr numeric,
  fifties numeric,
  hundreds numeric,
  fours numeric,
  sixes numeric,
  ducks numeric,

  -- bowling (raw)
  bowl_matches numeric,
  bowl_innings numeric,
  overs numeric,
  maidens numeric,
  wickets numeric,
  bowl_runs numeric,
  economy numeric,
  bowl_avg numeric,
  bowl_sr numeric,
  three_w numeric,
  five_w numeric,
  dot_balls numeric,
  wides numeric,
  noballs numeric,

  -- fielding (raw)
  catches numeric,
  run_outs numeric,

  -- keeping (raw)
  is_keeper boolean not null default false,
  stumpings numeric,
  keeping_catches numeric,

  -- computed index scores (0-100), filled on import
  bat_index numeric,
  bowl_index numeric,
  field_index numeric,
  keep_index numeric,
  overall_index numeric,

  -- our auction-day data
  is_bought boolean not null default false,
  bought_price numeric,
  suggested_batting_order int,
  utility_tag text,

  created_at timestamptz not null default now()
);

create index if not exists scout_players_overall_idx on scout_players (overall_index desc nulls last);
create index if not exists scout_players_bought_idx on scout_players (is_bought);

alter table scout_players enable row level security;

-- Single trusted team: any authenticated user can read and write.
drop policy if exists "scout_players_read" on scout_players;
create policy "scout_players_read" on scout_players for select
  using (auth.uid() is not null);

drop policy if exists "scout_players_write" on scout_players;
create policy "scout_players_write" on scout_players for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
