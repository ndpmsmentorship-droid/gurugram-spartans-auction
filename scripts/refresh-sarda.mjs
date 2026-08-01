// One-command refresh: log into the Sarda league portal, pull the whole pool for
// a season, and load it into scout_players (replacing the current pool) with
// freshly computed indices. Handy while registrations are still open.
//
//   SARDA_USER=OwnerGurugramSpartans SARDA_PASS='...' SARDA_SEASON=6 \
//     node --experimental-strip-types --env-file=.env.local scripts/refresh-sarda.mjs

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
  const token = await login();
  const players = await fetchAllPlayers(token);
  console.log(`Season ${SEASON}: fetched ${players.length} players`);

  const rows = players.map(mapPlayer).filter((r) => r.full_name);
  const idx = computeIndices(rows.map(toRaw));
  rows.forEach((r, i) => Object.assign(r, idx[i]));

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
  console.log(`Loaded ${rows.length} Season ${SEASON} players into the scout.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
