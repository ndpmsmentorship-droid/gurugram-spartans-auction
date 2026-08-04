-- Handedness + organizers' auction tier for scout players. The Anantinity API
-- export never carried these; the official registration .xlsx does:
--   battingStyle   → batting_style   (LHB / RHB)
--   bowlingStyles  → bowling_style   (Right-arm off-break, …)
--   category       → auction_category (U35A / U35B / 35+A / 35+B — the tier the
--                    organizers set, shown on the cards)
-- Run once in Supabase, then run the official-file import so they populate.
--   (Safe to run repeatedly.)

alter table scout_players add column if not exists batting_style text;
alter table scout_players add column if not exists bowling_style text;
alter table scout_players add column if not exists auction_category text;
