-- ============================================================
-- Live board: all eight SARDA S6 Elite squads across the twelve cards
-- Run once in the Supabase SQL Editor. Applied to prod 2026-08-28.
--
-- Two of the twelve SDLL franchises — Lucknow Strikers and Bhojpuri Dabangs —
-- have no SARDA counterpart (see team_source_schema.sql), so their cards were
-- empty, and two SARDA Elite squads (UP Warriors, Japani Tsunami) had nobody
-- carrying them.
--
-- Those two franchises are NOT renamed or deleted: they play real Season 2
-- fixtures (10 of the 34) and hold points-table rows, and fixtures.home/away_
-- team_id is `on delete set null`, so either would damage /schedule. Instead
-- two board-only carrier teams are added for the missing Elite squads, flagged
-- is_mock = true — the flag every "real franchise list" query already filters
-- on (lib/schedule/data.ts, admin/schedule, admin/teams, admin/owners), so the
-- schedule, standings and owner admin stay a clean twelve.
--
-- The board itself (app/auction/page.tsx) shows a card only where a squad
-- exists — a borrowed SARDA squad or live signings — which is what keeps the
-- two source-less franchises off it. Result: 12 cards = all 8 SARDA Elite
-- squads + 4 Challengers squads (Chennai Thalaivas, NCR Turbo Chargers,
-- Patna Panthers, Uttrakhand Yoddhas).
--
-- ⚠ seed_sccl_s6_teams.sql deletes bids for is_mock teams — do not re-run it
--   against this season.
-- ============================================================

begin;

insert into teams (season_id, name, division, purse_total, purse_remaining,
                   purse_max, is_mock, source_team_id)
select s.id, v.name, v.grp, 300000, 300000, 450000, true, sarda.id
  from (values
    ('UP Warriors',    'Group A'),
    ('Japani Tsunami', 'Group B')
  ) as v(name, grp)
  cross join (select id from seasons where is_active) s
  join (
    select t.id, t.name
      from teams t
      join seasons se on se.id = t.season_id
     where se.name ilike '%SARDA%' and t.division = 'Elite'
  ) sarda on sarda.name = v.name
 where not exists (
   select 1 from teams x
    where x.season_id = s.id and x.name = v.name
 );

-- every Elite squad must now be carried by some board team
do $$
declare v_missing int;
begin
  select count(*) into v_missing
    from teams e
    join seasons s on s.id = e.season_id
   where s.name ilike '%SARDA%' and e.division = 'Elite'
     and not exists (select 1 from teams b where b.source_team_id = e.id);
  if v_missing > 0 then
    raise exception '% SARDA Elite squad(s) not carried by any board team', v_missing;
  end if;
end $$;

commit;
