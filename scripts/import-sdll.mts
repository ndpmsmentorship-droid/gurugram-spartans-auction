// SDLL pool import — pulls every registered player from the league's own
// platform (services.sdll.anantanity.com) into scout_players, CLEAN SLATE:
// nobody is assigned to a team, Season-1 results are NOT carried over.
// The 9 platform-excluded players import as reg_status='rejected' so they are
// visible but filterable, never silently dropped.
//
// Idempotent: upserts on source_id (the platform's Mongo id), so re-running
// close to auction day refreshes stats/photos and picks up new registrations
// without duplicating anyone. It does NOT touch team_id/sold_price — a re-sync
// mid-auction cannot undo a sale.
//
// Run: SDLL_EMAIL=... SDLL_PASSWORD=... node scripts/import-sdll.mts
// (or put the two keys in .env.local)
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { computeIndices, type RawStats } from "../src/lib/scout/rankings.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const API = "https://services.sdll.anantanity.com/api";
const TOURNAMENT_ID = "698076ecb979f0b07afdb8d0"; // Shanti Devi Cricket League

function loadEnv() {
  const raw = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = loadEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const EMAIL = process.env.SDLL_EMAIL || env.SDLL_EMAIL;
const PASS = process.env.SDLL_PASSWORD || env.SDLL_PASSWORD;
if (!EMAIL || !PASS) throw new Error("Set SDLL_EMAIL / SDLL_PASSWORD");

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
};

// "A+ Category" → "A+", "Special Status" → "Special" — the short display names
// the app's normCategory() treats as canonical.
function shortCategory(c: unknown): string | null {
  const t = (str(c) ?? "").toUpperCase();
  if (!t) return null;
  if (t.startsWith("A+")) return "A+";
  if (t.startsWith("SPECIAL") || t === "SS") return "Special";
  if (t.startsWith("A")) return "A";
  if (t.startsWith("B")) return "B";
  return null;
}

async function login(): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const j = await res.json();
  if (!j?.token) throw new Error("SDLL login failed");
  return j.token;
}

// One oversized page, NOT page-by-page: the endpoint has no stable sort, so
// consecutive pages overlap — a 100-per-page sweep once returned 295 rows of
// which only 175 were distinct, and the upsert silently collapsed the rest.
async function fetchAll(token: string): Promise<Row[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const res = await fetch(
    `${API}/admin/players/tournament/${TOURNAMENT_ID}?page=1&limit=2000`,
    { headers }
  );
  const j = await res.json();
  const rows: Row[] = j?.data ?? [];
  const distinct = new Set(rows.map((r) => String(r._id)));
  if (distinct.size !== rows.length) {
    throw new Error(`Duplicate rows from the platform: ${rows.length} fetched, ${distinct.size} distinct`);
  }
  return rows;
}

function mapRow(p: Row) {
  const bat = p.battingStats ?? {};
  const bowl = p.bowlingStats ?? {};
  const reg = (p.registeredForTournaments ?? []).find(
    (r: Row) => String(r.tournament) === TOURNAMENT_ID
  );

  // The platform reports economy/average but often 0 for overs/runs — rebuild
  // them so the strike-rate maths in the index engine has real inputs.
  let bowlRuns = num(bowl.runs);
  const wicketsRaw = num(bowl.wickets);
  const bowlAvg = num(bowl.average);
  if ((bowlRuns == null || bowlRuns === 0) && bowlAvg != null && wicketsRaw != null) {
    bowlRuns = Math.round(bowlAvg * wicketsRaw);
  }
  const econ = num(bowl.economy);
  let overs = num(bowl.overs);
  if ((overs == null || overs === 0) && econ != null && econ > 0 && bowlRuns != null && bowlRuns > 0) {
    overs = Math.round((bowlRuns / econ) * 10) / 10;
  }
  let wickets = wicketsRaw;
  const whole = overs == null ? null : Math.floor(overs);
  const balls = overs == null ? null : whole! * 6 + Math.round((overs - whole!) * 10);
  if (wickets != null && balls != null && wickets > balls) wickets = null;

  const dob = str(p.dob);
  const age =
    dob == null
      ? null
      : Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));

  const role = str(p.primaryRole);
  const roleLc = (role ?? "").toLowerCase();

  return {
    source_id: String(p._id),
    full_name: str(p.name) ?? "(unnamed)",
    primary_role: role,
    auction_category: shortCategory(p.category ?? reg?.category),
    scout_category: str(p.subCategory), // platform sub-band (A+, A, B1–B3, SS)
    photo_url: str(p.photo),
    cricheroes_link: str(p.cricHeroesProfile),
    batting_style: str(p.battingStyle),
    bowling_style: str(p.bowlingStyle),
    age,
    is_keeper: /keep|wicket ?keeper|(^|\W)wk(\W|$)/i.test(roleLc),
    // CLEAN SLATE: excluded players stay visible but filterable.
    reg_status: reg?.isExcluded ? "rejected" : "registered",
    is_rejected: !!reg?.isExcluded,
    team_id: null,
    sold_price: null,
    acquired: null,
    is_bought: false,

    bat_matches: num(bat.matches),
    bat_innings: num(bat.innings),
    runs: num(bat.runs),
    highest_score: str(bat.highest),
    bat_avg: num(bat.average),
    bat_sr: num(bat.strikeRate),
    fifties: num(bat.fifties),
    hundreds: num(bat.hundreds),
    fours: num(bat.fours),
    sixes: num(bat.sixes),

    bowl_matches: num(bowl.matches),
    bowl_innings: num(bowl.innings),
    overs,
    maidens: num(bowl.maidens),
    wickets,
    bowl_runs: bowlRuns,
    economy: econ,
    bowl_avg: bowlAvg,
    bowl_sr: num(bowl.strikeRate),
    five_w: num(bowl.fiveWickets),
    // The SDLL platform does not publish fielding numbers — these stay null and
    // the fielding index flattens across the pool. Not a bug; no data exists.
    catches: null,
    run_outs: null,
    stumpings: null,
    keeping_catches: null,
  };
}

const token = await login();
const rows = await fetchAll(token);
console.log(`Fetched ${rows.length} registered players from the SDLL platform.`);
if (rows.length < 200) throw new Error(`Only ${rows.length} players — expected ~295. Aborting.`);

const players = rows.map(mapRow);

const raw: RawStats[] = players.map((p) => ({
  bat_matches: p.bat_matches, bat_innings: p.bat_innings, not_out: null, runs: p.runs,
  bat_avg: p.bat_avg, bat_sr: p.bat_sr, fifties: p.fifties, hundreds: p.hundreds,
  fours: p.fours, sixes: p.sixes,
  bowl_matches: p.bowl_matches, overs: p.overs, wickets: p.wickets, economy: p.economy,
  bowl_avg: p.bowl_avg, bowl_sr: p.bowl_sr, dot_balls: null, bowl_fours: null,
  bowl_sixes: null, five_w: p.five_w, catches: null, run_outs: null,
  is_keeper: p.is_keeper, stumpings: null, keeping_catches: null, primary_role: p.primary_role,
}));
const idx = computeIndices(raw);
const finalRows = players.map((p, i) => ({
  ...p,
  bat_index: idx[i].bat_index,
  bowl_index: idx[i].bowl_index,
  field_index: idx[i].field_index,
  keep_index: idx[i].keep_index,
  overall_index: idx[i].overall_index,
}));

for (let i = 0; i < finalRows.length; i += 100) {
  const { error } = await admin
    .from("scout_players")
    .upsert(finalRows.slice(i, i + 100), { onConflict: "source_id" });
  if (error) throw new Error(`upsert @${i}: ${error.message}`);
  console.log(`  upserted ${Math.min(i + 100, finalRows.length)}/${finalRows.length}`);
}

const byCat: Record<string, number> = {};
for (const r of finalRows) byCat[r.auction_category ?? "(none)"] = (byCat[r.auction_category ?? "(none)"] ?? 0) + 1;
const excluded = finalRows.filter((r) => r.is_rejected).length;
const photos = finalRows.filter((r) => r.photo_url).length;
console.log(
  `\nDone. ${finalRows.length} players, all unassigned (clean slate).` +
  `\n  categories: ${JSON.stringify(byCat)}` +
  `\n  excluded (rejected): ${excluded} · with photos: ${photos}`
);
