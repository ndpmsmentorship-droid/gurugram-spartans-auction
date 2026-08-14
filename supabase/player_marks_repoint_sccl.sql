-- Re-point the owner watchlist at the SCCL pool.
-- The Targets page now marks players from sccl_s6_players (the SCCL roster the
-- auction actually runs on), not the SDLL scout_players table. The old foreign
-- key still references scout_players, so inserting a SCCL player_id fails.
--
-- Safe to run once. Existing marks referenced scout_players ids that don't
-- exist in sccl_s6_players, so we clear them before swapping the constraint.

begin;

-- 1. Drop the stale marks (they point at scout_players ids).
delete from player_marks
where player_id not in (select id from sccl_s6_players);

-- 2. Swap the foreign key to the SCCL roster.
alter table player_marks
  drop constraint if exists player_marks_player_id_fkey;

alter table player_marks
  add constraint player_marks_player_id_fkey
  foreign key (player_id) references sccl_s6_players(id) on delete cascade;

commit;
