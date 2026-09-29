"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { SEASON, BUCKET, MIN_AGE, ageOn, normalizePhone } from "./shared";

// Public registration (/register). Everything goes through the service role:
// player_master and registrations have RLS on with no policies, so the anon
// key can't read phone numbers, emails or Aadhaar paths.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = { from: (t: string) => any; storage: any };
const db = () => createAdminClient() as unknown as Sb;

const SETUP_HINT =
  "Registration isn't switched on yet. The league needs to run supabase/registration_schema.sql once.";

export type LookupResult =
  | { error: string }
  | { found: false; alreadyRegistered: boolean }
  | {
      found: true;
      alreadyRegistered: boolean;
      // Only what a player needs to recognise themselves: no email, no DOB.
      profile: {
        id: string;
        full_name: string;
        photo_url: string | null;
        primary_role: string | null;
        last_team: string | null;
        last_season: string | null;
        linkedin_link: string | null;
      };
    };

export async function lookupPlayer(rawPhone: string): Promise<LookupResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { error: "Enter a 10-digit mobile number." };

  const sb = db();
  const [{ data: master, error: e1 }, { data: reg, error: e2 }] = await Promise.all([
    sb
      .from("player_master")
      .select("id, full_name, photo_url, primary_role, last_team, last_season, linkedin_link")
      .eq("phone", phone)
      .maybeSingle(),
    sb.from("registrations").select("id").eq("season", SEASON).eq("phone", phone).maybeSingle(),
  ]);
  if (e1 || e2) return { error: SETUP_HINT };

  const alreadyRegistered = !!reg;
  if (!master) return { found: false, alreadyRegistered };
  return { found: true, alreadyRegistered, profile: master };
}

// Files go straight from the browser to private storage via one-time signed
// upload URLs. Routing them through a server action would hit Vercel's ~4.5 MB
// request cap with a photo and an Aadhaar scan together.
export async function prepareUploads(
  rawPhone: string,
  files: { kind: "photo" | "aadhaar"; ext: string }[]
): Promise<{ error?: string; uploads?: { kind: string; path: string; token: string }[] }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { error: "Enter a 10-digit mobile number." };

  const sb = db();
  const { error: bucketErr } = await sb.storage.getBucket(BUCKET);
  if (bucketErr) {
    const { error } = await sb.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: "5MB",
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    });
    if (error && !/exists/i.test(error.message)) return { error: "Uploads aren't available right now." };
  }

  const stamp = Date.now();
  const uploads = [];
  for (const f of files) {
    if (f.kind !== "photo" && f.kind !== "aadhaar") continue;
    const ext = /^(jpg|jpeg|png|webp|pdf)$/i.test(f.ext) ? f.ext.toLowerCase() : "bin";
    const path = `${SEASON}/${phone}/${f.kind}-${stamp}.${ext}`;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) return { error: "Uploads aren't available right now." };
    uploads.push({ kind: f.kind, path, token: data.token as string });
  }
  return { uploads };
}

export type RegistrationInput = {
  phone: string;
  masterId: string | null;
  full_name: string;
  dob: string;
  email: string;
  cricheroes_link: string;
  linkedin_link: string;
  batting_hand: string;
  bowling_type: string;
  allrounder: string;
  is_keeper: boolean;
  photo_path: string | null;
  aadhaar_path: string | null;
  tshirt_size: string;
  lower_size: string;
  jersey_number: string;
  jersey_name: string;
  fee_ack: boolean;
};

const clean = (s: string | null | undefined) => {
  const t = (s ?? "").trim();
  return t === "" ? null : t.slice(0, 300);
};

export async function submitRegistration(
  input: RegistrationInput
): Promise<{ error?: string; ok?: boolean }> {
  const phone = normalizePhone(input.phone);
  if (!phone) return { error: "Enter a 10-digit mobile number." };
  if (!input.fee_ack) return { error: "Please tick the registration fee declaration." };

  const sb = db();

  // Re-read the master row on the server instead of trusting the client's
  // "returning player" claim: it must belong to this phone number.
  let master: { id: string; full_name: string } | null = null;
  if (input.masterId) {
    const { data } = await sb
      .from("player_master")
      .select("id, full_name")
      .eq("id", input.masterId)
      .eq("phone", phone)
      .maybeSingle();
    master = data ?? null;
  }
  const returning = !!master;

  const name = clean(input.full_name) ?? master?.full_name ?? null;
  if (!name) return { error: "Please enter your full name." };
  if (!clean(input.jersey_name) || !clean(input.jersey_number))
    return { error: "Please fill in the name and number for your jersey." };
  if (!clean(input.tshirt_size) || !clean(input.lower_size))
    return { error: "Please choose your T-shirt and lower sizes." };
  if (!clean(input.linkedin_link)) return { error: "Please add your LinkedIn profile link." };

  // Uploaded files must sit under this player's own folder.
  const own = (p: string | null) => (p && p.startsWith(`${SEASON}/${phone}/`) ? p : null);
  const photo = own(input.photo_path);
  const aadhaar = own(input.aadhaar_path);

  if (!returning) {
    if (!input.dob) return { error: "Please enter your date of birth." };
    const age = ageOn(input.dob);
    if (age == null || age > 90) return { error: "Please check your date of birth." };
    if (age < MIN_AGE) return { error: `The league is open to players aged ${MIN_AGE} and above.` };
    if (!clean(input.email)) return { error: "Please enter your email." };
    if (!clean(input.cricheroes_link)) return { error: "Please add your CricHeroes profile link." };
    if (!input.batting_hand && !input.bowling_type && !input.allrounder && !input.is_keeper)
      return { error: "Please pick at least one playing role." };
    if (!photo) return { error: "Please upload a photo of yourself." };
    if (!aadhaar) return { error: "Please upload your Aadhaar card." };
  }

  const { error } = await sb.from("registrations").insert({
    season: SEASON,
    phone,
    master_id: master?.id ?? null,
    is_returning: returning,
    full_name: name,
    dob: input.dob || null,
    email: clean(input.email),
    cricheroes_link: clean(input.cricheroes_link),
    linkedin_link: clean(input.linkedin_link),
    batting_hand: clean(input.batting_hand),
    bowling_type: clean(input.bowling_type),
    allrounder: clean(input.allrounder),
    is_keeper: !!input.is_keeper,
    photo_path: photo,
    aadhaar_path: aadhaar,
    tshirt_size: clean(input.tshirt_size),
    lower_size: clean(input.lower_size),
    jersey_number: clean(input.jersey_number),
    jersey_name: clean(input.jersey_name),
    fee_ack: true,
  });

  if (error) {
    if (error.code === "23505")
      return { error: "This mobile number is already registered for Season 2. Contact the league to change your details." };
    if (/registrations/.test(error.message)) return { error: SETUP_HINT };
    return { error: "Couldn't save your registration. Please try again." };
  }
  return { ok: true };
}
