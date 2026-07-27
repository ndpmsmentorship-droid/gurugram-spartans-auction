alter table roster_entries add column if not exists is_captain boolean not null default false;
alter table roster_entries add column if not exists is_vice_captain boolean not null default false;
alter table roster_entries add column if not exists is_keeper boolean not null default false;
alter table roster_entries add column if not exists batting_order int;

drop policy if exists "roster_entries_owner_update" on roster_entries;
create policy "roster_entries_owner_update" on roster_entries for update
  using (owns_team(team_id)) with check (owns_team(team_id));
