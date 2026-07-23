-- Gurugram Spartans Auction Platform — initial schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).

create extension if not exists "pgcrypto";

-- ============================================================
-- Tables
-- ============================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'owner' check (role in ('admin', 'owner')),
  created_at timestamptz not null default now()
);

create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  name text not null,
  owner_profile_id uuid references profiles(id) on delete set null,
  is_mock boolean not null default false,
  purse_total numeric not null,
  purse_remaining numeric not null,
  logo_url text,
  created_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  age int,
  date_of_birth date,
  email text,
  phone text,
  city text,
  state text,
  country text,
  cricheroes_link text,
  linkedin_link text,
  primary_role text,
  batting_style text,
  bowling_style text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists player_season_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  category text,
  base_price numeric not null default 0,
  min_price numeric not null default 0,
  max_price numeric,
  status text not null default 'registered'
    check (status in ('registered', 'shortlisted', 'in_pool', 'sold', 'unsold')),
  batting_matches int,
  batting_innings int,
  batting_runs int,
  highest_score text,
  batting_avg numeric,
  batting_sr numeric,
  fifties int,
  hundreds int,
  bowling_matches int,
  overs numeric,
  wickets int,
  best_bowling text,
  economy numeric,
  bowling_avg numeric,
  bowling_sr numeric,
  five_wickets int,
  created_at timestamptz not null default now(),
  unique (player_id, season_id)
);

create table if not exists roster_entries (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  sold_price numeric not null,
  created_at timestamptz not null default now(),
  unique (player_id, season_id)
);

create table if not exists auction_state (
  season_id uuid primary key references seasons(id) on delete cascade,
  current_player_id uuid references players(id),
  current_bid_amount numeric,
  current_leading_team_id uuid references teams(id),
  status text not null default 'not_started'
    check (status in ('not_started', 'live', 'paused', 'ended')),
  updated_at timestamptz not null default now()
);

create table if not exists bids (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  amount numeric not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Helpers
-- ============================================================

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function owns_team(p_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from teams where id = p_team_id and owner_profile_id = auth.uid()
  );
$$;

-- Auto-create a profile row (role defaults to 'owner') when someone signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- RLS
-- ============================================================

alter table profiles enable row level security;
alter table seasons enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table player_season_stats enable row level security;
alter table roster_entries enable row level security;
alter table auction_state enable row level security;
alter table bids enable row level security;

-- profiles: read own or admin; update own display_name or admin anything
create policy "profiles_select" on profiles for select
  using (id = auth.uid() or is_admin());
create policy "profiles_update" on profiles for update
  using (id = auth.uid() or is_admin());

-- seasons: any authenticated user reads; admin writes
create policy "seasons_select" on seasons for select using (auth.uid() is not null);
create policy "seasons_write" on seasons for all using (is_admin()) with check (is_admin());

-- teams: any authenticated user reads; admin writes
create policy "teams_select" on teams for select using (auth.uid() is not null);
create policy "teams_write" on teams for all using (is_admin()) with check (is_admin());

-- players / stats: any authenticated user reads; admin writes
create policy "players_select" on players for select using (auth.uid() is not null);
create policy "players_write" on players for all using (is_admin()) with check (is_admin());

create policy "player_season_stats_select" on player_season_stats for select using (auth.uid() is not null);
create policy "player_season_stats_write" on player_season_stats for all using (is_admin()) with check (is_admin());

-- roster_entries: any authenticated user reads; admin writes directly (mark_sold also runs as definer)
create policy "roster_entries_select" on roster_entries for select using (auth.uid() is not null);
create policy "roster_entries_write" on roster_entries for all using (is_admin()) with check (is_admin());

-- auction_state: any authenticated user reads (realtime feed); admin writes directly for
-- start/pause/advance/end. Bid amount changes go through place_bid() below.
create policy "auction_state_select" on auction_state for select using (auth.uid() is not null);
create policy "auction_state_write" on auction_state for all using (is_admin()) with check (is_admin());

-- bids: any authenticated user reads (live feed / audit trail); no direct insert policy —
-- all bids must go through place_bid(), which runs as SECURITY DEFINER and validates the bidder.
create policy "bids_select" on bids for select using (auth.uid() is not null);

-- ============================================================
-- RPCs (bidding + settlement)
-- ============================================================

-- Owners (and admin, on behalf of mock teams) call this to place a bid on the
-- player currently up for auction. Validates ownership, auction status, bid
-- increment, and purse — then records the bid and updates auction_state
-- atomically so concurrent bids can't race each other.
create or replace function place_bid(
  p_season_id uuid,
  p_team_id uuid,
  p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state auction_state%rowtype;
  v_team teams%rowtype;
begin
  if not (owns_team(p_team_id) or is_admin()) then
    raise exception 'not authorized to bid for this team';
  end if;

  select * into v_state from auction_state where season_id = p_season_id for update;
  if not found or v_state.status <> 'live' or v_state.current_player_id is null then
    raise exception 'auction is not live for this season';
  end if;

  select * into v_team from teams where id = p_team_id and season_id = p_season_id for update;
  if not found then
    raise exception 'team not found for this season';
  end if;

  if p_amount <= coalesce(v_state.current_bid_amount, 0) then
    raise exception 'bid must be higher than the current bid';
  end if;

  if p_amount > v_team.purse_remaining then
    raise exception 'bid exceeds remaining purse';
  end if;

  insert into bids (season_id, player_id, team_id, amount)
  values (p_season_id, v_state.current_player_id, p_team_id, p_amount);

  update auction_state
  set current_bid_amount = p_amount,
      current_leading_team_id = p_team_id,
      updated_at = now()
  where season_id = p_season_id;
end;
$$;

-- Admin calls this to settle the player currently up for auction: sold to the
-- leading bidder (deducts purse, creates the roster entry) or unsold if no
-- bids were placed. Clears auction_state so the console can advance.
create or replace function mark_current_player_settled(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state auction_state%rowtype;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_state from auction_state where season_id = p_season_id for update;
  if not found or v_state.current_player_id is null then
    raise exception 'no player currently up for auction';
  end if;

  if v_state.current_leading_team_id is null then
    update player_season_stats
    set status = 'unsold'
    where player_id = v_state.current_player_id and season_id = p_season_id;
  else
    insert into roster_entries (season_id, player_id, team_id, sold_price)
    values (p_season_id, v_state.current_player_id, v_state.current_leading_team_id, v_state.current_bid_amount);

    update player_season_stats
    set status = 'sold'
    where player_id = v_state.current_player_id and season_id = p_season_id;

    update teams
    set purse_remaining = purse_remaining - v_state.current_bid_amount
    where id = v_state.current_leading_team_id;
  end if;

  update auction_state
  set current_player_id = null,
      current_bid_amount = null,
      current_leading_team_id = null,
      updated_at = now()
  where season_id = p_season_id;
end;
$$;

-- ============================================================
-- Realtime
-- ============================================================

alter publication supabase_realtime add table auction_state;
alter publication supabase_realtime add table bids;

-- Realtime UPDATE payloads only include the full "old" row (needed to tell
-- whether current_player_id actually changed) when replica identity is FULL.
alter table auction_state replica identity full;
