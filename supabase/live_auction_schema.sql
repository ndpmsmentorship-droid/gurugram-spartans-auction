-- ===========================================================================
-- PHASE 2 — auctioneer-driven live bidding, wired onto the LIVE pool
-- (scout_players + teams). Run once in the Supabase SQL editor.
--
-- This REPLACES the retired auction_state / bids / players / player_season_stats
-- path, which pointed at tables the pool no longer uses. Those are left alone
-- here; drop them separately once you're happy this is running.
--
-- Model: one auctioneer drives the room. They put a lot up, tap a team to
-- raise, and hammer it. Owners never write — they watch. Every mutation is a
-- SECURITY DEFINER function so the rules (purse, squad caps, bid ceiling) are
-- enforced on the server, not in the browser where they can be skipped.
--
-- Idempotent: safe to re-run.
-- ===========================================================================

-- ---- current lot ----------------------------------------------------------
-- Exactly one row per season. The board and the console both read this.
create table if not exists auction_lot (
  season_id       uuid primary key references seasons(id) on delete cascade,
  player_id       uuid references scout_players(id) on delete set null,
  status          text not null default 'idle'
                    check (status in ('idle', 'live', 'sold', 'unsold')),
  base_price      numeric,
  current_bid     numeric,
  leading_team_id uuid references teams(id) on delete set null,
  updated_at      timestamptz not null default now()
);

-- ---- append-only event log ------------------------------------------------
-- The room's record, and what makes undo possible. Never updated, only added to.
create table if not exists auction_event (
  id         bigserial primary key,
  season_id  uuid not null references seasons(id) on delete cascade,
  player_id  uuid references scout_players(id) on delete set null,
  team_id    uuid references teams(id) on delete set null,
  kind       text not null
               check (kind in ('put_up', 'raise', 'sell', 'unsold', 'undo')),
  amount     numeric,
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists auction_event_season_idx
  on auction_event (season_id, id desc);

-- ---- house rules, in one place -------------------------------------------
-- Kept as a table rather than constants so the organizers can change a cap on
-- the day without a deploy.
create table if not exists auction_rules (
  season_id     uuid primary key references seasons(id) on delete cascade,
  squad_min     int     not null default 16,
  squad_max     int     not null default 20,
  max_bid       numeric not null default 65000,
  base_grade_a  numeric not null default 15000,
  base_grade_b  numeric not null default 5000,
  min_increment numeric not null default 1000
);

insert into auction_rules (season_id)
select id from seasons where is_active
on conflict (season_id) do nothing;

-- ---------------------------------------------------------------------------
-- put_up_lot(season, player) — open a player for bidding.
-- ---------------------------------------------------------------------------
create or replace function put_up_lot(p_season uuid, p_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat  text;
  v_base numeric;
  v_rules auction_rules%rowtype;
begin
  select * into v_rules from auction_rules where season_id = p_season;
  if not found then
    raise exception 'No auction rules configured for this season';
  end if;

  select auction_category into v_cat from scout_players where id = p_player;
  if not found then
    raise exception 'Player not found';
  end if;

  if exists (select 1 from scout_players where id = p_player and team_id is not null) then
    raise exception 'That player is already sold';
  end if;

  -- 'A' = U35A / 35+A. Legend is its own compulsory slot and prices as B.
  v_base := case
    when upper(coalesce(v_cat, '')) like '%LEGEND%' then v_rules.base_grade_b
    when upper(replace(coalesce(v_cat, ''), ' ', '')) like '%A' then v_rules.base_grade_a
    else v_rules.base_grade_b
  end;

  insert into auction_lot (season_id, player_id, status, base_price, current_bid, leading_team_id, updated_at)
  values (p_season, p_player, 'live', v_base, null, null, now())
  on conflict (season_id) do update
    set player_id       = excluded.player_id,
        status          = 'live',
        base_price      = excluded.base_price,
        current_bid     = null,
        leading_team_id = null,
        updated_at      = now();

  insert into auction_event (season_id, player_id, kind, amount)
  values (p_season, p_player, 'put_up', v_base);
end;
$$;

-- ---------------------------------------------------------------------------
-- place_raise(season, team, amount) — the auctioneer records a team's bid.
-- Every rule is checked HERE. A browser cannot skip it.
-- ---------------------------------------------------------------------------
create or replace function place_raise(p_season uuid, p_team uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot   auction_lot%rowtype;
  v_rules auction_rules%rowtype;
  v_spent numeric;
  v_purse numeric;
  v_squad int;
begin
  select * into v_lot from auction_lot where season_id = p_season for update;
  if not found or v_lot.status <> 'live' or v_lot.player_id is null then
    raise exception 'No lot is live';
  end if;

  select * into v_rules from auction_rules where season_id = p_season;

  if p_amount > v_rules.max_bid then
    raise exception 'Bid % is over the % ceiling', p_amount, v_rules.max_bid;
  end if;

  if v_lot.current_bid is null then
    if p_amount < v_lot.base_price then
      raise exception 'Opening bid must be at least the % base price', v_lot.base_price;
    end if;
  elsif p_amount < v_lot.current_bid + v_rules.min_increment then
    raise exception 'Raise must be at least % above the current bid', v_rules.min_increment;
  end if;

  if v_lot.leading_team_id = p_team then
    raise exception 'That team is already the highest bidder';
  end if;

  select coalesce(sum(sold_price), 0), count(*)
    into v_spent, v_squad
    from scout_players where team_id = p_team;

  select purse_total into v_purse from teams where id = p_team;
  if not found then
    raise exception 'Team not found';
  end if;

  if v_spent + p_amount > v_purse then
    raise exception 'Over purse: % spent + % exceeds %', v_spent, p_amount, v_purse;
  end if;

  if v_squad >= v_rules.squad_max then
    raise exception 'Squad is already full (%)', v_rules.squad_max;
  end if;

  update auction_lot
     set current_bid = p_amount, leading_team_id = p_team, updated_at = now()
   where season_id = p_season;

  insert into auction_event (season_id, player_id, team_id, kind, amount)
  values (p_season, v_lot.player_id, p_team, 'raise', p_amount);
end;
$$;

-- ---------------------------------------------------------------------------
-- hammer_lot(season) — sell to the leading team. Assignment and lot close are
-- one transaction, so a failure can't leave a player half-sold.
-- ---------------------------------------------------------------------------
create or replace function hammer_lot(p_season uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot auction_lot%rowtype;
begin
  select * into v_lot from auction_lot where season_id = p_season for update;
  if not found or v_lot.status <> 'live' then
    raise exception 'No lot is live';
  end if;
  if v_lot.leading_team_id is null or v_lot.current_bid is null then
    raise exception 'No bids on this lot — mark it unsold instead';
  end if;

  update scout_players
     set team_id    = v_lot.leading_team_id,
         sold_price = v_lot.current_bid,
         acquired   = 'auction'
   where id = v_lot.player_id;

  insert into auction_event (season_id, player_id, team_id, kind, amount)
  values (p_season, v_lot.player_id, v_lot.leading_team_id, 'sell', v_lot.current_bid);

  update auction_lot set status = 'sold', updated_at = now() where season_id = p_season;
end;
$$;

-- ---------------------------------------------------------------------------
-- pass_lot(season) — no bids / withdrawn. Player returns to the pool.
-- ---------------------------------------------------------------------------
create or replace function pass_lot(p_season uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot auction_lot%rowtype;
begin
  select * into v_lot from auction_lot where season_id = p_season for update;
  if not found or v_lot.status <> 'live' then
    raise exception 'No lot is live';
  end if;

  insert into auction_event (season_id, player_id, kind)
  values (p_season, v_lot.player_id, 'unsold');

  update auction_lot set status = 'unsold', updated_at = now() where season_id = p_season;
end;
$$;

-- ---------------------------------------------------------------------------
-- undo_last_sale(season) — reverse the most recent hammer. Mis-hearing a bid
-- happens; this is the fix, and it is itself logged.
-- ---------------------------------------------------------------------------
create or replace function undo_last_sale(p_season uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ev auction_event%rowtype;
begin
  select * into v_ev
    from auction_event
   where season_id = p_season and kind = 'sell'
   order by id desc limit 1;

  if not found then
    raise exception 'No sale to undo';
  end if;

  if exists (select 1 from auction_event
              where season_id = p_season and kind = 'undo' and player_id = v_ev.player_id
                and id > v_ev.id) then
    raise exception 'That sale has already been undone';
  end if;

  update scout_players
     set team_id = null, sold_price = null, acquired = null
   where id = v_ev.player_id;

  insert into auction_event (season_id, player_id, team_id, kind, amount)
  values (p_season, v_ev.player_id, v_ev.team_id, 'undo', v_ev.amount);
end;
$$;

-- ---- realtime -------------------------------------------------------------
-- Owners' screens follow auction_lot. Best-effort: a failure here must not roll
-- back the tables above.
alter table auction_lot replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public'
          and tablename = 'auction_lot'
     ) then
    alter publication supabase_realtime add table auction_lot;
  end if;
exception when others then
  raise notice 'realtime publication step skipped: %', sqlerrm;
end $$;

-- ---- RLS ------------------------------------------------------------------
-- Anyone may WATCH. Nobody writes directly — all mutation goes through the
-- SECURITY DEFINER functions above, which the server actions call as admin.
alter table auction_lot   enable row level security;
alter table auction_event enable row level security;
alter table auction_rules enable row level security;

drop policy if exists auction_lot_read   on auction_lot;
drop policy if exists auction_event_read on auction_event;
drop policy if exists auction_rules_read on auction_rules;

create policy auction_lot_read   on auction_lot   for select using (true);
create policy auction_event_read on auction_event for select using (true);
create policy auction_rules_read on auction_rules for select using (true);
