-- Gurugram Spartans Scout — fine player category override (2026-08 add-on)
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- Adds a manual override column for the fine role category shown on the pool.
-- When null/blank, the app falls back to an auto-derived category (see
-- src/lib/scout/category.ts). Values are the labels from CATEGORIES there, e.g.
-- 'Top Order', 'Middle Order', 'Fast Bowler', 'Off Break', 'Wicket-Keeper', …

alter table scout_players add column if not exists scout_category text;

-- Marquee / probable "must-buy" target, flagged manually from the pool page.
alter table scout_players add column if not exists is_marquee boolean not null default false;

create index if not exists scout_players_marquee_idx on scout_players (is_marquee);
