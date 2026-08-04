// Non-destructive refresh: pull the latest registrations from the Sarda /
// Anantinity league portal and rebuild scout_players WITHOUT losing the manual
// curation on existing players — marquee picks, category overrides, mock buys,
// and scouting notes are carried over (matched by CricHeroes profile id, else
// normalized name).
//
//   node --experimental-strip-types --env-file=.env.local \
//     scripts/refresh-sarda-preserve.mjs
//
// Env (in .env.local): SARDA_USER, SARDA_PASS, SARDA_SEASON (opt, default 6),
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { computeIndices } from "../src/lib/scout/rankings.ts";
import { mapPlayer, toRaw } from "./sarda-map.mjs";

const BASE = "https://sarda-corporate-league.anantanity.com";
const USER = process.env.SARDA_USER;
const PASS = process.env.SARDA_PASS;
const SEASON = process.env.SARDA_SEASON || "6";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// fields that represent our manual curation and must survive a refresh
const PRESERVE_FIELDS = [
  "is_marquee",
  "scout_category",
  "is_bought",
  "bought_price",
  "suggested_batting_order",
  "utility_tag",
  "scouting_clip_url",
  "scouting_note",
];

const croId = (link) => {
  if (!link) return null;
  const m = String(link).match(/player-profile\/(\d+)/);
  return m ? m[1] : null;
};
const identity = (row) =>
  croId(row.cricheroes_link) ||
  (row.full_name || "").trim().toLowerCase().replace(/\s+/g, " ");

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const data = await res.json();
  if (!res.ok || !data?.data?.token?.token) {
    throw new Error(`Login failed: ${data?.message || res.status}`);
  }
  return data.data.token.token;
}

async function fetchAllPlayers(token) {
  const headers = { Authorization: `Bearer ${token}` };
  const first = await (
    await fetch(`${BASE}/api/players?season=${SEASON}&limit=100&page=1`, { headers })
  ).json();
  const totalPages = first.totalPages ?? 1;
  const all = [...first.data];
  for (let pg = 2; pg <= totalPages; pg++) {
    const d = await (
      await fetch(`${BASE}/api/players?season=${SEASON}&limit=100&page=${pg}`, { headers })
    ).json();
    all.push(...d.data);
  }
  const seen = new Set();
  return all.filter((p) => (seen.has(p._id) ? false : seen.add(p._id)));
}

async function main() {
  if (!USER || !PASS) throw new Error("Set SARDA_USER and SARDA_PASS env vars.");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

  // 1) snapshot the WHOLE current pool to a file before we touch anything, so a
  // failed rebuild can always be restored (never repeat the in-memory-only loss).
  const { data: existing, error: exErr } = await supabase
    .from("scout_players")
    .select("*");
  if (exErr) throw exErr;

  if ((existing || []).length > 0) {
    const backupPath = `pool-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(backupPath, JSON.stringify(existing, null, 2));
    console.log(`Backed up ${existing.length} rows to ${backupPath}`);
  }

  const preserve = new Map();
  for (const e of existing || []) {
    const kept = {};
    for (const f of PRESERVE_FIELDS) if (e[f] != null) kept[f] = e[f];
    preserve.set(identity(e), kept);
  }
  const prevMarquee = (existing || []).filter((e) => e.is_marquee).length;
  const prevCat = (existing || []).filter((e) => e.scout_category).length;
  const prevBought = (existing || []).filter((e) => e.is_bought).length;
  console.log(
    `Existing pool: ${(existing || []).length} rows — preserving ${prevMarquee} marquee, ${prevCat} category, ${prevBought} bought.`
  );

  // 2) pull the latest registrations
  const token = await login();
  const players = await fetchAllPlayers(token);
  console.log(`Season ${SEASON}: fetched ${players.length} players from Anantinity`);

  const rows = players.map(mapPlayer).filter((r) => r.full_name);
  const idx = computeIndices(rows.map(toRaw));
  rows.forEach((r, i) => Object.assign(r, idx[i]));

  // 3) merge preserved curation back onto matching players
  let carried = 0;
  for (const r of rows) {
    const kept = preserve.get(identity(r));
    if (kept && Object.keys(kept).length) {
      Object.assign(r, kept);
      carried++;
    }
  }
  console.log(`Carried curation onto ${carried} returning players.`);

  // ensure NOT NULL boolean columns always have a value (mapPlayer omits them)
  for (const r of rows) {
    if (r.is_bought == null) r.is_bought = false;
    if (r.is_rejected == null) r.is_rejected = false;
    if (r.is_marquee == null) r.is_marquee = false;
  }

  // 4) rebuild the pool
  const { error: delErr } = await supabase
    .from("scout_players")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delErr) throw delErr;

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from("scout_players").insert(rows.slice(i, i + CHUNK));
    if (error) throw error;
  }
  console.log(
    `Done. Loaded ${rows.length} Season ${SEASON} players; curation preserved.`
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
