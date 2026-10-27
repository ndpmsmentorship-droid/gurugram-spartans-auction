-- SDLL Season 2 registration v2 (playfulventures.co.in, 27 Oct 2026).
-- Run ONCE in the Supabase SQL Editor (project hlouwxtyotrmlehaxgav) BEFORE the
-- v2 form goes live. Safe to re-run: every statement is "if not exists".

alter table registrations
  -- terms (v1 addendum from the parked player-terms branch, folded in here)
  add column if not exists terms_version    text,
  -- work + profiles
  add column if not exists employer         text,
  add column if not exists designation      text,
  add column if not exists instagram_link   text,
  -- face photo: photo_path = 1080px JPEG, thumb = 384px WebP for instant loads
  add column if not exists photo_thumb_path text,
  -- cricket background self-declaration
  add column if not exists pro_declared     boolean,
  add column if not exists pro_level        text,
  add column if not exists pro_last_year    int,
  -- ₹1,000 registration fee (UPI until Razorpay)
  add column if not exists fee_amount       int,
  add column if not exists fee_utr          text,
  add column if not exists fee_proof_path   text,
  add column if not exists fee_status       text not null default 'pending',  -- pending | verified | rejected
  add column if not exists fee_verified_at  timestamptz,
  -- daily vetting (professional-cricket + corporate + face checks)
  add column if not exists vet_status       text not null default 'unchecked', -- unchecked | clear | review | flagged | rejected
  add column if not exists vet_notes        text,
  add column if not exists vet_sources      jsonb,
  add column if not exists face_check       text,                              -- ok | no_face | many_faces | small | blurry
  add column if not exists vet_checked_at   timestamptz;

-- One UPI payment can pay for one registration only.
create unique index if not exists registrations_fee_utr_key on registrations (fee_utr) where fee_utr is not null;

-- Tell PostgREST about the new columns straight away.
notify pgrst, 'reload schema';
