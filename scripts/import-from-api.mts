// Full re-sync from the live SCCL dashboard (anantanity) — the authoritative
// source. Pulls every registered player with their real category, price, team
// assignment (owners/retained), photo and stats; computes the Player Index; and
// replaces scout_players. Owners/retained get team_id + sold_price + acquired.
//
// Run: SCCL_USERNAME=... SCCL_PASSWORD=... node scripts/import-from-api.mts
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { computeIndices, type RawStats } from "../src/lib/scout/rankings.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = process.env.SCCL_BASE_URL || "https://sarda-corporate-league.anantanity.com";
const SEASON = Number(process.env.SCCL_SEASON) || 6;

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
const USER = process.env.SCCL_USERNAME || env.SCCL_USERNAME;
const PASS = process.env.SCCL_PASSWORD || env.SCCL_PASSWORD;
if (!USER || !PASS) throw new Error("Set SCCL_USERNAME / SCCL_PASSWORD");

type Row = Record<string, unknown>;
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const pickNum = (...vals: unknown[]): number | null => {
  const ns = vals.map(num);
  return ns.find((n) => n != null && n !== 0) ?? ns.find((n) => n != null) ?? null;
};
const str = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
};
const absUrl = (v: unknown): string | null => {
  const s = str(v);
  return s ? (s.startsWith("/") ? BASE + s : s) : null;
};
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const j = await res.json();
  const token = j?.data?.token?.token;
  if (!token) throw new Error("login failed");
  return token;
}

async function fetchAll(token: string): Promise<Row[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const out: Row[] = [];
  let page = 1;
  for (;;) {
    const res = await fetch(`${BASE}/api/players?limit=100&page=${page}&season=${SEASON}`, { headers });
    const j = await res.json();
    const d = j?.data;
    const rows: Row[] = Array.isArray(d) ? d : (d?.players ?? []);
    out.push(...rows);
    if (page >= (j?.totalPages ?? 1)) break;
    page++;
  }
  return out;
}

const token = await login();
const rows = (await fetchAll(token)).filter((r) => String(r["Name"] ?? "").trim() !== "");
console.log(`Fetched ${rows.length} players from the live dashboard (season ${SEASON}).`);

// --- team map (teamBought name -> my team_id) ---
const { data: season } = await admin.from("seasons").select("id").eq("is_active", true).maybeSingle();
if (!season) throw new Error("no active season");
// align JNK -> J&K (authoritative)
await admin.from("teams").update({ name: "J&K Homelanders" }).eq("season_id", (season as any).id).eq("name", "JNK Homelanders");
const { data: teams } = await admin.from("teams").select("id, name").eq("season_id", (season as any).id);
const teamByName = new Map<string, string>();
for (const t of (teams ?? []) as { id: string; name: string }[]) teamByName.set(norm(t.name), t.id);

// --- map a row -> scout_players insert ---
function mapRow(p: Row) {
  const role = str(p["playingAs"]) || str(p["skill"]);
  const roleLc = (role ?? "").toLowerCase();
  const econ = pickNum(p["Economy"], p["economy"]);
  const bowlRuns = num(p["bowling_runs"]);
  let overs = num(p["overs"]);
  if (econ != null && econ > 0 && bowlRuns != null && bowlRuns > 0) {
    const est = Math.round((bowlRuns / econ) * 10) / 10;
    if (overs == null || est > overs * 1.5) overs = est;
  }
  let wickets = pickNum(p["Wickets"], p["wickets"]);
  const whole = overs == null ? null : Math.floor(overs);
  const balls = overs == null ? null : whole! * 6 + Math.round((overs - whole!) * 10);
  if (wickets != null && balls != null && wickets > balls) wickets = null;

  const isOwner = !!p["isOwner"];
  const isRetained = !!p["isRetained"];
  const sold = str(p["auctionStatus"]) === "sold";
  const acquired = isOwner ? "owner" : isRetained ? "retained" : sold ? "auction" : null;
  const teamId = p["teamBought"] ? teamByName.get(norm(p["teamBought"])) ?? null : null;
  const price = pickNum(p["priceBought"], p["soldPrice"]);

  return {
    row: {
      full_name: String(p["Name"]).trim(),
      primary_role: role,
      auction_category: str(p["category"]),
      photo_url: absUrl(p["Player Image"]),
      cricheroes_link: str(p["Cric Heroes Profile"]),
      age: num(p["age"]) != null ? Math.round(num(p["age"])!) : null,
      is_keeper: /keep|wicket ?keeper|(^|\W)wk(\W|$)/i.test(roleLc),
      bat_matches: pickNum(p["batting_matches"], p["Matches"]),
      bat_innings: num(p["batting_innings"]),
      not_out: num(p["not_out"]),
      runs: num(p["batting_runs"]),
      highest_score: str(p["highest_runs"]),
      bat_avg: pickNum(p["Batting Avg"], p["batting_avg"]),
      bat_sr: pickNum(p["Batting SR"], p["batting_sr"]),
      fifties: num(p["50s"]),
      hundreds: num(p["100s"]),
      fours: num(p["bating_4s"]),
      sixes: num(p["bating_6s"]),
      ducks: num(p["ducks"]),
      bowl_matches: num(p["bowling_matches"]),
      bowl_innings: num(p["bowling_innings"]),
      overs,
      maidens: num(p["maidens"]),
      wickets,
      bowl_runs: bowlRuns,
      economy: econ,
      bowl_avg: num(p["bowling_avg"]),
      bowl_sr: num(p["bowling_sr"]),
      three_w: num(p["3_wickets"]),
      five_w: num(p["5_wickets"]),
      dot_balls: num(p["dot_balls"]),
      bowl_fours: num(p["bowling_4s"]),
      bowl_sixes: num(p["bowling_6s"]),
      wides: num(p["wides"]),
      noballs: num(p["noballs"]),
      catches: num(p["Catches"]),
      run_outs: num(p["Run outs"]),
      stumpings: num(p["Stumpings"]),
      keeping_catches: num(p["Caught behind"]),
      team_id: teamId,
      sold_price: teamId ? price : null,
      acquired: teamId ? acquired : null,
      is_bought: false,
    },
    unmatchedTeam: p["teamBought"] && !teamId ? String(p["teamBought"]) : null,
  };
}

const mapped = rows.map(mapRow);
const unmatched = [...new Set(mapped.map((m) => m.unmatchedTeam).filter(Boolean))];
if (unmatched.length) console.log("UNMATCHED teams:", unmatched);

const players = mapped.map((m) => m.row);
const raw: RawStats[] = players.map((p) => ({
  bat_matches: p.bat_matches, bat_innings: p.bat_innings, not_out: p.not_out, runs: p.runs,
  bat_avg: p.bat_avg, bat_sr: p.bat_sr, fifties: p.fifties, hundreds: p.hundreds, fours: p.fours, sixes: p.sixes,
  bowl_matches: p.bowl_matches, overs: p.overs, wickets: p.wickets, economy: p.economy,
  bowl_avg: p.bowl_avg, bowl_sr: p.bowl_sr, dot_balls: p.dot_balls, bowl_fours: p.bowl_fours,
  bowl_sixes: p.bowl_sixes, five_w: p.five_w, catches: p.catches, run_outs: p.run_outs,
  is_keeper: p.is_keeper, stumpings: p.stumpings, keeping_catches: p.keeping_catches, primary_role: p.primary_role,
}));
const idx = computeIndices(raw);
const finalRows = players.map((p, i) => ({
  ...p, bat_index: idx[i].bat_index, bowl_index: idx[i].bowl_index, field_index: idx[i].field_index,
  keep_index: idx[i].keep_index, overall_index: idx[i].overall_index,
}));

console.log("Clearing scout_players…");
const del = await admin.from("scout_players").delete().neq("id", "00000000-0000-0000-0000-000000000000");
if (del.error) throw new Error(del.error.message);
for (let i = 0; i < finalRows.length; i += 200) {
  const { error } = await admin.from("scout_players").insert(finalRows.slice(i, i + 200));
  if (error) throw new Error(`insert @${i}: ${error.message}`);
  console.log(`  inserted ${Math.min(i + 200, finalRows.length)}/${finalRows.length}`);
}

const owners = finalRows.filter((r) => r.acquired === "owner").length;
const retained = finalRows.filter((r) => r.acquired === "retained").length;
const sold = finalRows.filter((r) => r.acquired === "auction").length;
const pool = finalRows.filter((r) => !r.team_id).length;
const photos = finalRows.filter((r) => r.photo_url).length;
console.log(`\nDone. ${finalRows.length} players: ${pool} pool · ${owners} owners · ${retained} retained · ${sold} auction-sold · ${photos} with photos.`);
