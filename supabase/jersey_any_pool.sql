-- ============================================================
-- jersey_sizes: allow kit entries for borrowed squads
-- Run once in the Supabase SQL Editor.
--
-- jersey_sizes.player_id had a foreign key to scout_players, which was right
-- when every squad came from the live SDLL pool. Squads are now borrowed from
-- the SARDA archive for the prototype (teams.source_team_id), so the players
-- with actual kit numbers live in sccl_s6_players and the FK rejects them:
--   23503  Key (player_id)=(...) is not present in table "scout_players"
--
-- Postgres can't reference two tables from one column, so the constraint is
-- dropped rather than repointed. player_id stays a uuid identifying a player in
-- EITHER pool; rows are written only by admin server actions, so nothing
-- untrusted reaches it.
-- ============================================================

alter table jersey_sizes drop constraint if exists jersey_sizes_player_id_fkey;

comment on column jersey_sizes.player_id is
  'Player uuid from scout_players OR sccl_s6_players (borrowed squads). No FK: a column cannot reference two tables.';

-- Kit sizes are no longer collected or displayed — the squad page shows name
-- and jersey number only. The columns stay for the archived /jersey form data.
comment on column jersey_sizes.tshirt_size is 'Legacy: no longer shown on /squad.';
comment on column jersey_sizes.lower_size  is 'Legacy: no longer shown on /squad.';
