-- ===========================================================================
-- SHANTI DEVI LEGEND'S LEAGUE — season cutover, v2.
-- Built from the league's own platform (services.sdll.anantanity.com,
-- pulled 14-Aug-26): 12 franchises in two groups, 4 player categories,
-- purse base ₹3,00,000 (top-ups to ₹4,50,000), ₹500 bid increments.
--
-- What this does, in order:
--   1. Archives the ENTIRE SARDA pool (766 rows, all columns) to
--      sccl_s6_players, and jersey_sizes to sccl_s6_jersey_sizes.
--   2. Empties scout_players and jersey_sizes — the SDLL pool is imported
--      separately by scripts/import-sdll.mts (295 registered players).
--   3. Retires the SCCL S6 season; creates the SDLL season as active.
--   4. Inserts the 12 SDLL teams (clean slate: purse ₹3,00,000 each).
--   5. Rebuilds auction_rules around the SDLL category system and updates
--      put_up_lot / place_raise to price and cap by category.
--
-- ⚠ RUNNING THIS CHANGES WHAT THE LIVE PUBLIC SITE DISPLAYS — the pool and
--   squads blank until the import runs. Run both back to back.
--
-- One transaction: all lands or none does. Double-run refused by the guard.
-- ===========================================================================

begin;

-- ---- guard: refuse to run twice -------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'sccl_s6_players') then
    raise exception 'sccl_s6_players already exists — this migration has already run';
  end if;
end $$;

-- ---- 1. archive SARDA S6 wholesale ----------------------------------------
-- Full-row copies, not just allocations: the SDLL pool REPLACES this data in
-- scout_players, so everything must survive somewhere queryable.
create table sccl_s6_players as select * from scout_players;

do $$
declare v_n int; v_alloc int; v_sum numeric;
begin
  select count(*), count(*) filter (where team_id is not null), sum(sold_price)
    into v_n, v_alloc, v_sum from sccl_s6_players;
  if v_n <> 766 or v_alloc <> 442 or v_sum <> 7403000 then
    raise exception 'Archive mismatch: % rows, % allocated, % total (expected 766/442/7403000)',
      v_n, v_alloc, v_sum;
  end if;
end $$;

create table sccl_s6_jersey_sizes as select * from jersey_sizes;

alter table sccl_s6_players      enable row level security;
alter table sccl_s6_jersey_sizes enable row level security;
-- no policies: service-role only. History, not an app surface.

-- ---- 2. clean slate ---------------------------------------------------------
delete from jersey_sizes;
delete from scout_players;

-- The importer upserts on the platform's own id so re-syncs update in place
-- instead of duplicating players.
alter table scout_players add column if not exists source_id text;
create unique index if not exists scout_players_source_id_key
  on scout_players (source_id);

-- ---- 3. seasons -------------------------------------------------------------
update seasons set is_active = false where is_active;

insert into seasons (name, is_active)
values ('Shanti Devi Legend''s League — Season 2', true);
-- If the next auction runs under a different banner:
--   update seasons set name = '...' where is_active;

-- ---- 4. the 12 SDLL franchises ---------------------------------------------
-- Names and groups verbatim from the platform. Purse: clean slate at the
-- platform's basePurse ₹3,00,000; purse_max mirrors its ₹4,50,000 top-up cap.
-- Season-1 top-ups are NOT carried — grant them on the day with:
--   update teams set purse_total = purse_total + 50000 where name = '...';
insert into teams (season_id, name, division, purse_total, purse_remaining, purse_max, is_mock)
select s.id, v.name, v.grp, 300000, 300000, 450000, false
  from (values
    ('ACCI',                  'Group A'),
    ('Bengal Tigers',         'Group A'),
    ('Chennai Thalaiva',      'Group A'),
    ('Lucknow Strikers',      'Group A'),
    ('NCR Turbo Chargers',    'Group A'),
    ('Patna Panthers',        'Group A'),
    ('Bhojpuri Dabangs',      'Group B'),
    ('Goan Monks',            'Group B'),
    ('Gurugram Spartans',     'Group B'),
    ('Jaipur Royals',         'Group B'),
    ('Punjab Royals Legends', 'Group B'),
    ('Uttrakhand Yoddhas',    'Group B')
  ) as v(name, grp),
  (select id from seasons where is_active) s;

-- ---- 5. rules, rebuilt around the SDLL category system ----------------------
-- Source: tournament config on the platform, 14-Aug-26.
--   A+      U35    base 30,000   max 3 per team
--   A       U35    base 20,000   max 8 per team
--   B       18–39  base 10,000   max 13 per team
--   Special 35–45  base  5,000   max 3 per team
-- max_bid 4,00,000 = the platform's price ceiling (effectively purse-bound).
-- min_increment 500 — Season 1 cleared at ₹500 steps (…372,500 / …431,500).
drop table if exists auction_rules cascade;
create table auction_rules (
  season_id     uuid primary key references seasons(id) on delete cascade,
  squad_min     int     not null default 16,
  squad_max     int     not null default 25,
  max_bid       numeric not null default 400000,
  min_increment numeric not null default 500,
  base_a_plus   numeric not null default 30000,
  base_a        numeric not null default 20000,
  base_b        numeric not null default 10000,
  base_special  numeric not null default 5000,
  cap_a_plus    int     not null default 3,
  cap_a         int     not null default 8,
  cap_b         int     not null default 13,
  cap_special   int     not null default 3
);

alter table auction_rules enable row level security;
drop policy if exists auction_rules_read on auction_rules;
create policy auction_rules_read on auction_rules for select using (true);

insert into auction_rules (season_id)
select id from seasons where is_active;

-- ---- helper: category -> base price ----------------------------------------
-- The importer stores auction_category as the display name: A+ / A / B / Special.
create or replace function category_base(p_cat text, p_rules auction_rules)
returns numeric
language sql
immutable
as $$
  select case upper(coalesce(p_cat, ''))
    when 'A+'      then p_rules.base_a_plus
    when 'A'       then p_rules.base_a
    when 'B'       then p_rules.base_b
    when 'SPECIAL' then p_rules.base_special
    else p_rules.base_b
  end;
$$;

-- ---- put_up_lot: reprice by SDLL category -----------------------------------
create or replace function put_up_lot(p_season uuid, p_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat   text;
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

  insert into auction_lot (season_id, player_id, status, base_price, current_bid, leading_team_id, updated_at)
  values (p_season, p_player, 'live', category_base(v_cat, v_rules), null, null, now())
  on conflict (season_id) do update
    set player_id       = excluded.player_id,
        status          = 'live',
        base_price      = excluded.base_price,
        current_bid     = null,
        leading_team_id = null,
        updated_at      = now();

  insert into auction_event (season_id, player_id, kind, amount)
  values (p_season, p_player, 'put_up', category_base(v_cat, v_rules));
end;
$$;

-- ---- place_raise: purse, squad AND per-category caps ------------------------
create or replace function place_raise(p_season uuid, p_team uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot     auction_lot%rowtype;
  v_rules   auction_rules%rowtype;
  v_cat     text;
  v_cat_cap int;
  v_cat_n   int;
  v_spent   numeric;
  v_purse   numeric;
  v_squad   int;
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

  -- per-category cap: a team may hold at most N players of the lot's category
  select auction_category into v_cat from scout_players where id = v_lot.player_id;
  v_cat_cap := case upper(coalesce(v_cat, ''))
    when 'A+'      then v_rules.cap_a_plus
    when 'A'       then v_rules.cap_a
    when 'B'       then v_rules.cap_b
    when 'SPECIAL' then v_rules.cap_special
    else v_rules.cap_b
  end;
  select count(*) into v_cat_n
    from scout_players
   where team_id = p_team and upper(coalesce(auction_category, '')) = upper(coalesce(v_cat, ''));
  if v_cat_n >= v_cat_cap then
    raise exception 'Category % is full for that team (max %)', v_cat, v_cat_cap;
  end if;

  update auction_lot
     set current_bid = p_amount, leading_team_id = p_team, updated_at = now()
   where season_id = p_season;

  insert into auction_event (season_id, player_id, team_id, kind, amount)
  values (p_season, v_lot.player_id, p_team, 'raise', p_amount);
end;
$$;

-- hammer_lot / pass_lot / undo_last_sale are category-agnostic — the versions
-- from live_auction_schema.sql stand unchanged.

-- ---- verify before commit ---------------------------------------------------
do $$
declare v_pool int; v_teams int; v_arch int;
begin
  select count(*) into v_pool  from scout_players;
  select count(*) into v_arch  from sccl_s6_players;
  select count(*) into v_teams from teams
   where season_id = (select id from seasons where is_active);
  raise notice 'pool now: % (expect 0, import follows) · archived: % · SDLL teams: %',
    v_pool, v_arch, v_teams;
  if v_pool <> 0 or v_arch <> 766 or v_teams <> 12 then
    raise exception 'Post-migration state wrong — rolling back';
  end if;
end $$;

commit;
