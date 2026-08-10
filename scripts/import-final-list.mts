// One-off: load the organizers' FINAL auction list (7th Aug) into scout_players,
// compute the Player Index with the app's real ranking engine, then apply the
// owner retentions from the "Team Owners" sheet.
//
// Run:  node scripts/import-final-list.mts
// Reads Supabase creds from .env.local (service-role — bypasses RLS).

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { computeIndices, type RawStats } from "../src/lib/scout/rankings.ts";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const XLSX_PATH =
  process.env.XLSX_PATH ??
  "/Users/nikhildhingra/Downloads/For_owners_final_auction_list_7th_Aug.xlsx";

// ---- env ----
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
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase env in .env.local");
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ---- helpers ----
const norm = (s: unknown) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function cleanNumber(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim().replace(/,/g, "");
  if (s === "" || !/^-?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
const cleanPhone = (raw: unknown): string | null => {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d || null;
};
// overs X.Y -> balls, to sanity-check wickets
function oversToBalls(overs: number | null): number | null {
  if (overs == null) return null;
  const whole = Math.floor(overs);
  const balls = Math.round((overs - whole) * 10);
  if (balls > 5) return null;
  return whole * 6 + balls;
}

// ---- read registrations sheet as array-of-arrays, map by normalized header ----
const wb = XLSX.readFile(XLSX_PATH);
const regSheetName = wb.SheetNames.find((n) => norm(n).startsWith("sscl6 registrations"))!;
const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[regSheetName], { header: 1, defval: null });
const header = (grid[0] as unknown[]).map(norm);
const colIndex = (target: string) => header.indexOf(target);
const idx = {
  skill: colIndex("skill"),
  playingAs: colIndex("playingas"),
  category: colIndex("category"),
  fullName: colIndex("fullname"),
  email: colIndex("email"),
  phone: colIndex("phone"),
  age: colIndex("age"),
  cric: colIndex("cricheroesprofile"),
  bat_matches: colIndex("batting matches"),
  bat_innings: colIndex("batting innings"),
  not_out: colIndex("not out"),
  runs: colIndex("batting runs"),
  highest: colIndex("highest runs"),
  bat_avg: colIndex("batting avg"),
  bat_sr: colIndex("batting sr"),
  fifties: colIndex("50s"),
  hundreds: colIndex("100s"),
  fours: colIndex("bating 4s"),
  sixes: colIndex("bating 6s"),
  ducks: colIndex("ducks"),
  bowl_matches: colIndex("bowling matches"),
  bowl_innings: colIndex("bowling innings"),
  overs: colIndex("overs"),
  maidens: colIndex("maidens"),
  wickets: colIndex("wickets"),
  bowl_runs: colIndex("bowling runs"),
  three_w: colIndex("3 wickets"),
  five_w: colIndex("5 wickets"),
  economy: colIndex("economy"),
  bowl_sr: colIndex("bowling sr"),
  bowl_avg: colIndex("bowling avg"),
  wides: colIndex("wides"),
  noballs: colIndex("noballs"),
  dot_balls: colIndex("dot balls"),
  bowl_fours: colIndex("bowling 4s"),
  bowl_sixes: colIndex("bowling 6s"),
  run_outs: colIndex("run outs"),
  stumpings: colIndex("stumpings"),
  keeping_catches: colIndex("caught behind"),
  catches: colIndex("catches"),
};

type PlayerRow = Record<string, unknown> & { full_name: string; primary_role: string | null };
const players: PlayerRow[] = [];
const warnings: string[] = [];

for (let r = 1; r < grid.length; r++) {
  const row = grid[r] as unknown[];
  const name = String(row[idx.fullName] ?? "").trim();
  if (!name) continue;
  const skill = String(row[idx.skill] ?? "");
  const playingAs = String(row[idx.playingAs] ?? "").trim();
  const role = playingAs || skill.replace(/_/g, " ");
  const isKeeper = /keeper|wicket_keeper|wk/i.test(skill) || /keep/i.test(role);
  const ageNum = cleanNumber(row[idx.age]);
  const econ = cleanNumber(row[idx.economy]);
  const bowlRuns = cleanNumber(row[idx.bowl_runs]);
  // The sheet's `overs` is truncated/corrupt for many rows (e.g. shows 1 for a
  // bowler with 8k runs conceded). Reconstruct from runs ÷ economy, which is
  // internally consistent, and only override when the sheet value looks wrong.
  const sheetOvers = cleanNumber(row[idx.overs]);
  let overs = sheetOvers;
  if (econ != null && econ > 0 && bowlRuns != null && bowlRuns > 0) {
    const est = Math.round((bowlRuns / econ) * 10) / 10;
    if (sheetOvers == null || est > sheetOvers * 1.5) overs = est;
  }
  let wickets = cleanNumber(row[idx.wickets]);
  const balls = oversToBalls(overs);
  if (wickets != null && balls != null && wickets > balls) {
    warnings.push(`${name}: wickets ${wickets} > balls ${balls} — dropped`);
    wickets = null;
  }
  const highestRaw = row[idx.highest];
  players.push({
    full_name: name,
    primary_role: role || null,
    auction_category: (String(row[idx.category] ?? "").trim() || null),
    cricheroes_link: (String(row[idx.cric] ?? "").trim() || null),
    email: (String(row[idx.email] ?? "").trim() || null),
    phone: cleanPhone(row[idx.phone]),
    age: ageNum == null ? null : Math.round(ageNum),
    is_keeper: isKeeper,
    bat_matches: cleanNumber(row[idx.bat_matches]),
    bat_innings: cleanNumber(row[idx.bat_innings]),
    not_out: cleanNumber(row[idx.not_out]),
    runs: cleanNumber(row[idx.runs]),
    highest_score: highestRaw == null || highestRaw === "" ? null : String(highestRaw).trim(),
    bat_avg: cleanNumber(row[idx.bat_avg]),
    bat_sr: cleanNumber(row[idx.bat_sr]),
    fifties: cleanNumber(row[idx.fifties]),
    hundreds: cleanNumber(row[idx.hundreds]),
    fours: cleanNumber(row[idx.fours]),
    sixes: cleanNumber(row[idx.sixes]),
    ducks: cleanNumber(row[idx.ducks]),
    bowl_matches: cleanNumber(row[idx.bowl_matches]),
    bowl_innings: cleanNumber(row[idx.bowl_innings]),
    overs,
    maidens: cleanNumber(row[idx.maidens]),
    wickets,
    bowl_runs: cleanNumber(row[idx.bowl_runs]),
    three_w: cleanNumber(row[idx.three_w]),
    five_w: cleanNumber(row[idx.five_w]),
    economy: cleanNumber(row[idx.economy]),
    bowl_sr: cleanNumber(row[idx.bowl_sr]),
    bowl_avg: cleanNumber(row[idx.bowl_avg]),
    wides: cleanNumber(row[idx.wides]),
    noballs: cleanNumber(row[idx.noballs]),
    dot_balls: cleanNumber(row[idx.dot_balls]),
    bowl_fours: cleanNumber(row[idx.bowl_fours]),
    bowl_sixes: cleanNumber(row[idx.bowl_sixes]),
    catches: cleanNumber(row[idx.catches]),
    run_outs: cleanNumber(row[idx.run_outs]),
    stumpings: cleanNumber(row[idx.stumpings]),
    keeping_catches: cleanNumber(row[idx.keeping_catches]),
  });
}

console.log(`Parsed ${players.length} players from "${regSheetName}".`);

// ---- ranking engine ----
const rawForIndex: RawStats[] = players.map((p) => ({
  bat_matches: p.bat_matches as number | null,
  bat_innings: p.bat_innings as number | null,
  not_out: p.not_out as number | null,
  runs: p.runs as number | null,
  bat_avg: p.bat_avg as number | null,
  bat_sr: p.bat_sr as number | null,
  fifties: p.fifties as number | null,
  hundreds: p.hundreds as number | null,
  fours: p.fours as number | null,
  sixes: p.sixes as number | null,
  bowl_matches: p.bowl_matches as number | null,
  overs: p.overs as number | null,
  wickets: p.wickets as number | null,
  economy: p.economy as number | null,
  bowl_avg: p.bowl_avg as number | null,
  bowl_sr: p.bowl_sr as number | null,
  dot_balls: p.dot_balls as number | null,
  bowl_fours: p.bowl_fours as number | null,
  bowl_sixes: p.bowl_sixes as number | null,
  five_w: p.five_w as number | null,
  catches: p.catches as number | null,
  run_outs: p.run_outs as number | null,
  is_keeper: p.is_keeper as boolean,
  stumpings: p.stumpings as number | null,
  keeping_catches: p.keeping_catches as number | null,
  primary_role: p.primary_role,
}));
const indices = computeIndices(rawForIndex);

const rows = players.map((p, i) => ({
  ...p,
  bat_index: indices[i].bat_index,
  bowl_index: indices[i].bowl_index,
  field_index: indices[i].field_index,
  keep_index: indices[i].keep_index,
  overall_index: indices[i].overall_index,
  is_bought: false,
}));

// ---- replace pool ----
console.log("Clearing existing scout_players…");
const del = await admin.from("scout_players").delete().neq("id", "00000000-0000-0000-0000-000000000000");
if (del.error) throw new Error(`clear failed: ${del.error.message}`);

const CHUNK = 200;
for (let i = 0; i < rows.length; i += CHUNK) {
  const slice = rows.slice(i, i + CHUNK);
  const { error } = await admin.from("scout_players").insert(slice);
  if (error) throw new Error(`insert failed at ${i}: ${error.message}`);
  console.log(`  inserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
}
console.log(`Imported ${rows.length} players with computed indices.`);

// ---- owners (playing) + retentions, from scripts/sccl-roster.json ----
// Categories/costs are derived from the Team Owners sheet's cell fill colours
// (Legend/A/B) by scripts/extract-roster.py. Non-playing owners are excluded
// there, so they never touch the purse. Cost tiers (Legend treated as B):
//   owner:    A ₹15,000 · B/Legend ₹6,000
//   retained: A ₹20,000 · B/Legend ₹10,000
type RosterEntry = { team: string; name: string; kind: "owner" | "retained"; category: string; cost: number };
const roster: RosterEntry[] = JSON.parse(
  fs.readFileSync(path.join(ROOT, "scripts", "sccl-roster.json"), "utf8"),
);

const { data: season } = await admin.from("seasons").select("id").eq("is_active", true).maybeSingle();
if (!season) throw new Error("no active season");
const { data: teams } = await admin.from("teams").select("id, name").eq("season_id", (season as any).id);
const teamByName = new Map<string, string>();
for (const t of (teams ?? []) as { id: string; name: string }[]) teamByName.set(norm(t.name), t.id);

// players from DB (freshly inserted) — to link roster names to the auction pool
const { data: dbPlayers } = await admin.from("scout_players").select("id, full_name");
const playerByNorm = new Map<string, string[]>();
for (const p of (dbPlayers ?? []) as { id: string; full_name: string }[]) {
  const k = norm(p.full_name);
  playerByNorm.set(k, [...(playerByNorm.get(k) ?? []), p.id]);
}
const allNorms = [...playerByNorm.keys()];
const claimed = new Set<string>(); // player ids already assigned this run

function findPlayer(name: string): { id?: string; note: string } {
  const q = norm(name);
  if (!q) return { note: "empty" };
  const exact = (playerByNorm.get(q) ?? []).filter((id) => !claimed.has(id));
  if (exact.length === 1) return { id: exact[0], note: "exact" };
  if (exact.length > 1) return { note: `ambiguous(${exact.length}) exact` };
  const qTokens = q.split(" ");
  const cands = allNorms.filter((n) => qTokens.every((t) => n.split(" ").includes(t)));
  const freeCands = cands.flatMap((c) => (playerByNorm.get(c) ?? [])).filter((id) => !claimed.has(id));
  if (freeCands.length === 1) return { id: freeCands[0], note: "fuzzy" };
  if (freeCands.length > 1) return { note: `ambiguous(${freeCands.length}) fuzzy` };
  return { note: "no match" };
}

let linked = 0, created = 0;
const rosterErrors: string[] = [];
const spendByTeam = new Map<string, number>();
for (const e of roster) {
  const teamId = teamByName.get(norm(e.team));
  if (!teamId) { rosterErrors.push(`TEAM not found: ${e.team}`); continue; }
  spendByTeam.set(e.team, (spendByTeam.get(e.team) ?? 0) + e.cost);
  const { id } = findPlayer(e.name);
  if (id) {
    claimed.add(id);
    const { error } = await admin
      .from("scout_players")
      .update({ team_id: teamId, sold_price: e.cost, acquired: e.kind })
      .eq("id", id);
    if (error) rosterErrors.push(`${e.team}/${e.name}: ${error.message}`);
    else linked++;
  } else {
    const { data: ins, error } = await admin.from("scout_players").insert({
      full_name: e.name,
      team_id: teamId,
      acquired: e.kind,
      sold_price: e.cost,
      auction_category: e.category,
      is_keeper: false,
      is_bought: false,
    }).select("id").single();
    if (error) rosterErrors.push(`${e.team}/${e.name}: ${error.message}`);
    else { created++; if (ins) claimed.add((ins as any).id); }
  }
}

const owners = roster.filter((e) => e.kind === "owner").length;
const retained = roster.filter((e) => e.kind === "retained").length;
console.log(`\nRoster applied: ${owners} owners + ${retained} retained (${linked} linked to pool, ${created} new rows).`);
console.log("Pre-auction spend per team:");
for (const [t, s] of [...spendByTeam.entries()].sort()) console.log(`  ${t}: ₹${s.toLocaleString("en-IN")}`);
if (rosterErrors.length) {
  console.log(`\nRoster errors (${rosterErrors.length}):`);
  for (const u of rosterErrors) console.log("  - " + u);
}
if (warnings.length) console.log(`\nData warnings: ${warnings.length} (overs/wickets guards)`);
console.log("\nDone.");
