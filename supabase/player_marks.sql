-- Owner watchlist: each owner can mark players from the auction pool as targets.
-- Shown in the "Marked players" section of their My Squad page.
-- Run in the Supabase SQL editor.

create table if not exists player_marks (
  marker_profile_id uuid not null references profiles(id) on delete cascade,
  player_id         uuid not null references scout_players(id) on delete cascade,
  note              text,
  created_at        timestamptz not null default now(),
  primary key (marker_profile_id, player_id)
);

alter table player_marks enable row level security;

-- Each owner sees and manages ONLY their own marks.
drop policy if exists player_marks_rw on player_marks;
create policy player_marks_rw on player_marks
  for all
  using (marker_profile_id = auth.uid())
  with check (marker_profile_id = auth.uid());

grant select, insert, update, delete on player_marks to authenticated;
