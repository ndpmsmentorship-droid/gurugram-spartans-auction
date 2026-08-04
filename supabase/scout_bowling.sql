-- Bowling boundaries conceded (fours / sixes hit off the bowler). Feeds the
-- boundary-concession % in the bowling index. Run once in Supabase, then
-- re-import / refresh the pool so the columns get populated + indices recompute.
--   (Safe to run repeatedly.)

alter table scout_players add column if not exists bowl_fours numeric;
alter table scout_players add column if not exists bowl_sixes numeric;
