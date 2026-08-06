-- Gurugram Spartans Scout — registration lifecycle (2026-08 add-on)
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- Adds the auction-day registration lifecycle used by the showcase board:
--   reg_status: 'registered' (default) | 'verified' | 'rejected'
-- (The SCCL auction tier already lives in auction_category — see the official
-- registration import; this is a separate registered/verified/rejected status.)

alter table scout_players
  add column if not exists reg_status text not null default 'registered';

-- carry the existing boolean reject flag into the new lifecycle
update scout_players set reg_status = 'rejected' where is_rejected = true;

create index if not exists scout_players_reg_status_idx on scout_players (reg_status);
