-- ===========================================================================
-- SHANTI DEVI LEGEND LEAGUE — season cutover.
--
-- What this does, in order:
--   1. Archives every SCCL S6 allocation to sccl_s6_archive (in-database copy;
--      a CSV of the same 442 rows is already at supabase/backups/).
--   2. Clears team_id / sold_price / acquired on scout_players — the pool
--      returns to 766 available players.
--   3. Retires the S6 season row and creates the SDLL season as active.
--   4. Deactivates the 24 SCCL teams (season-scoping them) and inserts the
--      new SDLL team set.
--   5. Seeds auction_rules for the new season.
--
-- ⚠ RUNNING THIS CHANGES WHAT THE LIVE PUBLIC SITE DISPLAYS: squads blank
--   the moment step 2 commits. Run it when you're ready for that, not before.
--
-- The whole thing is ONE TRANSACTION — it either all lands or none of it does.
-- Re-running after success is refused by the archive-exists guard.
-- ===========================================================================

begin;

-- ---- guard: refuse to run twice -------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'sccl_s6_archive') then
    raise exception 'sccl_s6_archive already exists — this migration has already run';
  end if;
end $$;

-- ---- 1. archive ------------------------------------------------------------
create table sccl_s6_archive as
select p.id as player_id,
       p.full_name,
       p.team_id,
       t.name as team_name,
       p.sold_price,
       p.acquired,
       p.auction_category,
       now() as archived_at
  from scout_players p
  join teams t on t.id = p.team_id
 where p.team_id is not null;

-- sanity: must match the 442 rows / 74,03,000 verified on 14-Aug-26
do $$
declare v_n int; v_sum numeric;
begin
  select count(*), sum(sold_price) into v_n, v_sum from sccl_s6_archive;
  if v_n <> 442 or v_sum <> 7403000 then
    raise exception 'Archive mismatch: % rows, % total (expected 442 / 7403000). Aborting.', v_n, v_sum;
  end if;
end $$;

alter table sccl_s6_archive enable row level security;
-- no policies: service-role only. History, not an app surface.

-- ---- 2. reset the pool -----------------------------------------------------
update scout_players
   set team_id = null, sold_price = null, acquired = null
 where team_id is not null;

-- ---- 3. seasons ------------------------------------------------------------
update seasons set is_active = false where is_active;

insert into seasons (name, is_active)
values ('Shanti Devi Legend League — Season 1', true);

-- ---- 4. teams --------------------------------------------------------------
-- The 24 SCCL teams stay as rows (the archive references them) but are parked
-- under the retired season so no query for the active season returns them.
-- >>> If `teams` has no season_id column this block needs adapting — check
-- >>> `select * from teams limit 1` first and tell me what columns exist.
update teams
   set season_id = (select id from seasons where name like 'SARDA%')
 where season_id is null
    or season_id <> (select id from seasons where is_active);

-- ---- SDLL team set ---------------------------------------------------------
-- ⚠ PLACEHOLDER — replace with the real Legend League franchises before
--   running. Name, division, purse per team. Purse below assumes ₹4,00,000;
--   correct it to the actual figure.
insert into teams (name, division, purse_total, season_id)
select v.name, v.division, v.purse, s.id
  from (values
    ('SDLL Team 1', 'Elite', 400000),
    ('SDLL Team 2', 'Elite', 400000),
    ('SDLL Team 3', 'Elite', 400000),
    ('SDLL Team 4', 'Elite', 400000)
  ) as v(name, division, purse),
  (select id from seasons where is_active) s;

-- ---- 5. rules for the new season -------------------------------------------
-- ⚠ PLACEHOLDER numbers — S6 cleared with a ₹1,00,000 top price, so the
--   ₹65,000 ceiling seeded earlier is likely wrong for SDLL too. Confirm.
insert into auction_rules
  (season_id, squad_min, squad_max, max_bid, base_grade_a, base_grade_b, min_increment)
select id, 16, 20, 65000, 15000, 5000, 1000
  from seasons where is_active
on conflict (season_id) do nothing;

-- ---- verify before commit ---------------------------------------------------
do $$
declare v_avail int; v_teams int;
begin
  select count(*) into v_avail from scout_players where team_id is null;
  select count(*) into v_teams from teams
   where season_id = (select id from seasons where is_active);
  raise notice 'available players: % (expect 766) · SDLL teams: %', v_avail, v_teams;
  if v_avail <> 766 then
    raise exception 'Pool reset incomplete: % available', v_avail;
  end if;
end $$;

commit;
