-- Re-point the owner watchlist at the SCCL pool.
-- The Targets page now marks players from sccl_s6_players (the SCCL roster the
-- auction actually runs on), not the SDLL scout_players table. The old foreign
-- key still references scout_players, so inserting a SCCL player_id fails.
--
-- sccl_s6_players was imported without a primary key, so player_id can't hold a
-- foreign key to it. We simply drop the old FK and leave player_id as a plain
-- uuid — the app already filters marks against the live roster on read, so an
-- orphaned mark (player later removed) just doesn't render.
--
-- Safe to run once.

begin;

-- Clear stale marks that pointed at the old scout_players ids.
delete from player_marks
where player_id not in (select id from sccl_s6_players);

-- Drop the constraint that tied player_id to scout_players.
alter table player_marks
  drop constraint if exists player_marks_player_id_fkey;

commit;
