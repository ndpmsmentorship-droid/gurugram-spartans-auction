-- Auction rewire onto the live pool (scout_players). Run once in the Supabase SQL editor.
-- Admin assigns a player to a team at a sold price; the live board reads these.
-- Each statement is idempotent; the realtime step is best-effort so it can't roll back the columns.

-- Ownership of a pooled player: which team owns them (null = still available),
-- what was paid, and how they were acquired. (Separate from is_bought/bought_price,
-- which the squad PLANNER uses — we don't touch those.)
alter table scout_players add column if not exists team_id    uuid references teams(id) on delete set null;
alter table scout_players add column if not exists sold_price numeric;
alter table scout_players add column if not exists acquired   text check (acquired in ('retained','auction'));

-- Fold the earlier retention column into team_id (it had no data), then drop it.
update scout_players set team_id = retained_by_team_id where retained_by_team_id is not null and team_id is null;
alter table scout_players drop column if exists retained_by_team_id;

create index if not exists scout_players_team_id_idx on scout_players (team_id);

-- Live board: stream scout_players changes over Supabase Realtime. Best-effort —
-- any issue here is skipped with a notice and does NOT undo the columns above.
alter table scout_players replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scout_players'
     ) then
    alter publication supabase_realtime add table scout_players;
  end if;
exception when others then
  raise notice 'realtime publication step skipped: %', sqlerrm;
end $$;
