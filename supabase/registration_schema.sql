-- ============================================================
-- SDLL player registration (/register) + admin review queue.
-- Run once in the Supabase SQL Editor. Additive and safe to re-run:
-- it creates two new tables and touches nothing that already exists.
--
--   player_master  one row per known player across every past season, keyed
--                  on a normalised 10-digit mobile. Filled by
--                  scripts/import-master.mts from Nikhil's merged player file.
--                  /register looks returning players up here by phone.
--   registrations  one row per player per season, written by the /register
--                  server action; reviewed at /admin/registrations.
--
-- Both tables have RLS ON and NO policies: only the service role (server
-- actions) can read or write them, so phone numbers, emails and Aadhaar
-- paths never reach the browser through the anon key.
-- Files (photo, Aadhaar) live in the PRIVATE storage bucket "registrations",
-- created by the app on first use; admins view them through short-lived
-- signed URLs.
-- ============================================================

create table if not exists player_master (
  id              uuid primary key default gen_random_uuid(),
  phone           text not null unique,        -- normalised: last 10 digits
  full_name       text not null,
  email           text,
  dob             date,
  photo_url       text,
  cricheroes_link text,
  linkedin_link   text,
  primary_role    text,
  batting_style   text,
  bowling_style   text,
  last_team       text,
  last_season     text,
  seasons         text[] not null default '{}', -- every season they appear in
  source          text,                          -- which file/sheet the row came from
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists registrations (
  id                uuid primary key default gen_random_uuid(),
  season            text not null default 'SDLL-S2',
  phone             text not null,
  master_id         uuid references player_master(id) on delete set null,
  is_returning      boolean not null default false,

  full_name         text not null,
  dob               date,
  email             text,
  cricheroes_link   text,
  linkedin_link     text,

  batting_hand      text,          -- 'Left Hand Batsman' | 'Right Hand Batsman'
  bowling_type      text,          -- 'Left Arm Pacer' | 'Left Arm Spinner' | 'Right Arm Pacer' | 'Right Arm Spin'
  allrounder        text,          -- 'Batting All Rounder' | 'Bowling All Rounder'
  is_keeper         boolean not null default false,

  photo_path        text,          -- storage path in bucket "registrations"
  aadhaar_path      text,          -- required for new players only

  tshirt_size       text,
  lower_size        text,
  jersey_number     text,
  jersey_name       text,

  fee_ack           boolean not null default false,

  status            text not null default 'pending'
                    check (status in ('pending', 'approved', 'under_review', 'rejected')),
  linkedin_verified boolean,       -- admin tick: 500+ connections seen
  admin_note        text,
  reviewed_at       timestamptz,
  reviewed_by       uuid,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (season, phone)           -- one registration per player per season
);

create index if not exists registrations_status_idx on registrations (season, status);

alter table player_master enable row level security;
alter table registrations enable row level security;
-- deliberately no policies: service role only.

-- ---- 2026-09-29 addendum: player card + name search ----------------------
-- Archive players with no known mobile (e.g. SARDA S6 squad members who were
-- never in a registration sheet) live in player_master with phone NULL, so a
-- returning player can find themselves by name when their number isn't on file.
-- UNIQUE still holds for non-null phones (Postgres allows many NULLs).
alter table player_master alter column phone drop not null;
alter table player_master
  add column if not exists is_owner boolean not null default false,
  add column if not exists category text,
  add column if not exists sold_amount numeric,
  add column if not exists stats jsonb;
-- 'phone' when the lookup matched the number, 'name' when the player picked
-- their profile from the name search (admin should double-check those).
alter table registrations add column if not exists matched_by text;
