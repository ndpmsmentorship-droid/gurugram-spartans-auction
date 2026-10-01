-- USCL Right to Match (2026-10-01). A matched RTM moves the player to the RTM
-- franchise: acquired = 'rtm', rtm_against = the team that had won him.
alter table scout_players drop constraint if exists scout_players_acquired_check;
alter table scout_players
  add constraint scout_players_acquired_check
  check (acquired in ('retained', 'auction', 'owner', 'rtm'));
alter table scout_players
  add column if not exists rtm_against uuid references teams(id) on delete set null;
