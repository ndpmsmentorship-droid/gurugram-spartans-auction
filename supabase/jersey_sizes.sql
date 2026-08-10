-- Kit/jersey collection for squad players. Filled via the public /jersey form
-- (writes go through a service-role server action, so RLS stays locked).
create table if not exists jersey_sizes (
  player_id uuid primary key references scout_players(id) on delete cascade,
  full_name text,
  display_name text,   -- name to print on the jersey
  jersey_number text,
  tshirt_size text,
  lower_size text,
  updated_at timestamptz default now()
);

-- if the table already exists from an earlier run, add the new column
alter table jersey_sizes add column if not exists display_name text;

alter table jersey_sizes enable row level security;
-- no public policies: only the service-role key (server actions) can read/write.
