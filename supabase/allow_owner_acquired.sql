-- Allow 'owner' as an acquisition type on scout_players so playing owners can be
-- seeded onto their squads (they occupy a slot and cost purse, like retentions).
alter table scout_players drop constraint if exists scout_players_acquired_check;

alter table scout_players
  add constraint scout_players_acquired_check
  check (acquired in ('retained', 'auction', 'owner'));
