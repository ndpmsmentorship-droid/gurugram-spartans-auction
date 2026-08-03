// One-off: turn a Sarda league /api/players export (pool_s6.json) into a CSV
// whose headers map cleanly onto src/lib/scout/importer.ts, then self-verify
// that every intended column resolves to the right CleanPlayer field.
//
//   node scripts/build-scout-csv.mjs <input.json> <output.csv>

import { readFileSync, writeFileSync } from "node:fs";

const [, , IN, OUT] = process.argv;
const all = JSON.parse(readFileSync(IN, "utf8"));

// prefer the first defined / non-empty value (Title-Case cols hold real
// numbers where the lower_snake duplicates are sometimes zeroed out)
const pick = (...vals) => {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return "";
};
const isKeeper = (p) => /keep|wicket ?keeper|(^|\W)wk(\W|$)/i.test(p.playingAs || p.skill || "");
// season-6 uploads store photos as site-relative paths ("/public/registrations/..")
// while older rows use absolute cricheroes URLs — make both absolute so they render.
const LEAGUE_ORIGIN = "https://sarda-corporate-league.anantanity.com";
const absUrl = (u) => {
  const s = String(u || "").trim();
  return s.startsWith("/") ? LEAGUE_ORIGIN + s : s;
};

// header : value  — headers chosen to hit importer.ts FIELD_ALIASES exactly
const COLUMNS = [
  ["Name", (p) => p.Name],
  ["age", (p) => (p.age != null ? Math.round(p.age) : "")],
  ["role", (p) => pick(p.playingAs, p.skill)],
  ["player image", (p) => absUrl(p["Player Image"])],
  ["cricheroes", (p) => p["Cric Heroes Profile"]],
  ["batting_matches", (p) => pick(p.batting_matches, p.Matches)],
  ["batting_innings", (p) => p.batting_innings],
  ["not_out", (p) => p.not_out],
  ["batting_runs", (p) => p.batting_runs],
  ["highest_runs", (p) => p.highest_runs],
  ["batting avg", (p) => pick(p["Batting Avg"], p.batting_avg)],
  ["batting sr", (p) => pick(p["Batting SR"], p.batting_sr)],
  ["50s", (p) => p["50s"]],
  ["100s", (p) => p["100s"]],
  ["bating_4s", (p) => p.bating_4s],
  ["bating_6s", (p) => p.bating_6s],
  ["ducks", (p) => p.ducks],
  ["bowling_matches", (p) => p.bowling_matches],
  ["bowling_innings", (p) => p.bowling_innings],
  ["overs", (p) => p.overs],
  ["maidens", (p) => p.maidens],
  ["wickets", (p) => pick(p.Wickets, p.wickets)],
  ["bowling_runs", (p) => p.bowling_runs],
  ["economy", (p) => pick(p.Economy, p.economy)],
  ["bowling_avg", (p) => p.bowling_avg],
  ["bowling_sr", (p) => p.bowling_sr],
  ["3_wickets", (p) => p["3_wickets"]],
  ["5_wickets", (p) => p["5_wickets"]],
  ["dot_balls", (p) => p.dot_balls],
  ["wides", (p) => p.wides],
  ["noballs", (p) => p.noballs],
  ["catches", (p) => p.Catches],
  ["run_outs", (p) => p["Run outs"]],
  ["stumpings", (p) => p.Stumpings],
  ["keeping_catches", (p) => p["Caught behind"]],
  ["is_keeper", (p) => (isKeeper(p) ? "yes" : "no")],
];

const headers = COLUMNS.map((c) => c[0]);
const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const lines = [headers.map(csvCell).join(",")];
for (const p of all) lines.push(COLUMNS.map(([, fn]) => csvCell(fn(p))).join(","));
writeFileSync(OUT, "﻿" + lines.join("\r\n"), "utf8");

// ---- self-verify: re-implement importer.ts mapping and assert ----
const FIELD_ALIASES = {
  full_name: ["full name", "name", "player name", "player"],
  age: ["age"],
  primary_role: ["cricketing skills", "skills", "role", "player type", "please state your cricketing skills"],
  photo_url: ["player image", "photo", "profile photo", "passport size photograph"],
  cricheroes_link: ["cric heros profile", "cricheroes profile", "cricheroes", "cricheroes link"],
  email: ["e mail id", "email", "e-mail", "email id"],
  phone: ["contact number", "phone", "mobile", "contact"],
  bat_matches: ["batting_matches", "batting matches", "bat matches", "matches"],
  bat_innings: ["batting_innings", "batting innings", "innings", "inns"],
  not_out: ["not_out", "not out", "no"],
  runs: ["batting_runs", "runs", "total runs"],
  highest_score: ["highest_runs", "highest", "highest score", "hs"],
  bat_avg: ["batting avg", "batting average", "bat avg", "average", "avg"],
  bat_sr: ["batting sr", "batting strike rate", "strike rate", "sr"],
  fifties: ["50s", "fifties", "half centuries"],
  hundreds: ["100s", "hundreds", "centuries"],
  fours: ["bating_4s", "batting_4s", "4s", "fours"],
  sixes: ["bating_6s", "batting_6s", "6s", "sixes"],
  ducks: ["ducks"],
  bowl_matches: ["bowling_matches", "bowling matches", "bowl matches"],
  bowl_innings: ["bowling_innings", "bowling innings", "bowl innings"],
  overs: ["overs", "overs bowled"],
  maidens: ["maidens", "maiden"],
  wickets: ["wickets", "wkts", "wicket"],
  bowl_runs: ["bowling_runs", "runs conceded", "bowl runs"],
  economy: ["economy", "econ", "eco"],
  bowl_avg: ["bowling_avg", "bowling average", "bowl avg"],
  bowl_sr: ["bowling_sr", "bowling strike rate", "bowl sr"],
  three_w: ["3_wickets", "3w", "three wickets", "3 wickets"],
  five_w: ["5_wickets", "5w", "five wickets", "5 wickets"],
  dot_balls: ["dot_balls", "dot balls", "dots"],
  wides: ["wides", "wide"],
  noballs: ["noballs", "no balls", "nb"],
  catches: ["catches", "ct", "catch", "fielding catches"],
  run_outs: ["run_outs", "run outs", "runouts", "ro", "run out"],
  is_keeper: ["is_keeper", "keeper", "wicketkeeper", "wk"],
  stumpings: ["stumpings", "st", "stumping", "stumps"],
  keeping_catches: ["keeping_catches", "keeper catches", "wk catches", "keeping catches"],
};
const normalize = (h) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const normHeaders = headers.map((raw) => ({ raw, norm: normalize(raw) }));
const fieldToHeader = new Map();
const used = new Set();
for (const field of Object.keys(FIELD_ALIASES)) {
  for (const alias of FIELD_ALIASES[field]) {
    const na = normalize(alias);
    const hit = normHeaders.find((h) => h.norm === na) ||
      normHeaders.find((h) => h.norm.includes(na) && !used.has(h.raw));
    if (hit && !used.has(hit.raw)) { fieldToHeader.set(field, hit.raw); used.add(hit.raw); break; }
  }
}
const want = COLUMNS.map((c) => c[0]);
const unmapped = want.filter((h) => !used.has(h));
const missingFields = Object.keys(FIELD_ALIASES).filter(
  (f) => !["email", "phone"].includes(f) && !fieldToHeader.has(f)
);
console.log(`rows: ${all.length}  columns: ${headers.length}`);
console.log("mapping (field <- header):");
for (const [f, h] of fieldToHeader) console.log(`  ${f} <- ${h}`);
if (unmapped.length) console.log("!! columns NOT consumed:", unmapped);
if (missingFields.length) console.log("!! fields left blank:", missingFields);
console.log(unmapped.length || missingFields.length ? "VERIFY: FAIL" : "VERIFY: OK (every column maps; every field filled)");
