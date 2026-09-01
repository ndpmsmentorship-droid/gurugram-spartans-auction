-- ============================================================
-- SDLL Season 2 prototype — "borrowed squad" mapping
-- Run once in the Supabase SQL Editor.
--
-- The SDLL S2 portal is a prototype: the 12 SDLL franchises are the product,
-- but their players were imported clean-slate with no stats, so there is
-- nothing to show on a board. The SARDA S6 archive DOES have real squads with
-- full stats.
--
-- Rather than rewrite that archive (SARDA is a live season Gurugram Spartans
-- is actually playing in), each SDLL team gets a pointer to the SARDA team
-- whose squad it borrows for display. Nothing is copied or destroyed; clearing
-- the pointer restores an empty squad.
-- ============================================================

alter table teams
  add column if not exists source_team_id uuid references teams(id) on delete set null;

comment on column teams.source_team_id is
  'Prototype only: the team whose archived squad is displayed for this team. Null = own squad.';

create index if not exists teams_source_team_idx on teams (source_team_id);

-- ---- seed the ten name matches ---------------------------------------------
-- Ten of the twelve SDLL franchises have a SARDA counterpart, some spelled
-- slightly differently. Lucknow Strikers and Bhojpuri Dabangs have none — pick
-- a source for those in Admin › Teams, or leave them empty.

with sdll as (
  select t.id, t.name
    from teams t
    join seasons s on s.id = t.season_id
   where s.is_active
),
sarda as (
  select t.id, t.name
    from teams t
    join seasons s on s.id = t.season_id
   where s.name ilike '%SARDA%'
),
pairs (sdll_name, sarda_name) as (
  values
    ('ACCI',                  'ACCI'),
    ('Bengal Tigers',         'Bengal Tigers'),
    ('Chennai Thalaiva',      'Chennai Thalaiva'),
    ('NCR Turbo Chargers',    'NCR Turbo Chargers'),
    ('Patna Panthers',        'Patna Panthers'),
    ('Gurugram Spartans',     'Gurugram Spartans'),
    ('Jaipur Royals',         'Jaipur Royals'),
    ('Goan Monks',            'Goa Monks'),
    ('Punjab Royals Legends', 'Punjab Royals'),
    ('Uttrakhand Yoddhas',    'Uttarakhand Yoddhas')
)
update teams t
   set source_team_id = sarda.id
  from pairs p
  join sdll  on sdll.name  = p.sdll_name
  join sarda on sarda.name = p.sarda_name
 where t.id = sdll.id;

-- Check: should list 10 mapped, 2 unmapped.
-- select t.name, src.name as borrows_from
--   from teams t
--   left join teams src on src.id = t.source_team_id
--   join seasons s on s.id = t.season_id
--  where s.is_active order by t.name;
