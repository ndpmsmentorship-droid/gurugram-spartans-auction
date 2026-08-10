-- Kit/jersey collection for squad players. Filled via the public /jersey form
-- (writes go through a service-role server action, so RLS stays locked).
create table if not exists jersey_sizes (
  player_id uuid primary key references scout_players(id) on delete cascade,
  full_name text,
  jersey_number text,
  tshirt_size text,
  lower_size text,
  updated_at timestamptz default now()
);

alter table jersey_sizes enable row level security;
-- no public policies: only the service-role key (server actions) can read/write.
