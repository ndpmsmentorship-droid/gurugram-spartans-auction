// Ingest manually-read player stats (e.g. from a CricHeroes screenshot) into
// the portal, then recompute pool-wide index scores with the real engine.
//
// Usage:
//   node --experimental-strip-types --env-file=.env.local \
//     scripts/ingest-stats.mjs '<json>'
//
// <json> is an array of updates, each: { "match": "<name substring or id>",
//   ...any scout_players stat columns... }. Example:
//   '[{"match":"Ayush Jagga","runs":28315,"bat_avg":47.59,"bat_sr":136.36,
//      "wickets":71,"economy":8.37,"catches":40,"stumpings":5,"is_keeper":true}]'

import { createClient } from "@supabase/supabase-js";
import { computeIndices } from "../src/lib/scout/rankings.ts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const RAW_KEYS = [
  "primary_role", "age", "is_keeper",
  "bat_matches", "bat_innings", "not_out", "runs", "highest_score",
  "bat_avg", "bat_sr", "fifties", "hundreds", "fours", "sixes", "ducks",
  "bowl_matches", "bowl_innings", "overs", "maidens", "wickets", "bowl_runs",
  "economy", "bowl_avg", "bowl_sr", "three_w", "five_w", "dot_balls",
  "wides", "noballs", "catches", "run_outs", "stumpings", "keeping_catches",
];

function toRaw(r) {
  return {
    bat_matches: r.bat_matches, bat_innings: r.bat_innings, not_out: r.not_out,
    runs: r.runs, bat_avg: r.bat_avg, bat_sr: r.bat_sr, fifties: r.fifties,
    hundreds: r.hundreds, fours: r.fours, sixes: r.sixes,
    bowl_matches: r.bowl_matches, overs: r.overs, wickets: r.wickets,
    economy: r.economy, bowl_avg: r.bowl_avg, bowl_sr: r.bowl_sr,
    dot_balls: r.dot_balls, five_w: r.five_w, catches: r.catches,
    run_outs: r.run_outs, is_keeper: r.is_keeper, stumpings: r.stumpings,
    keeping_catches: r.keeping_catches, primary_role: r.primary_role,
  };
}

async function findPlayer(match) {
  // exact id first, else case-insensitive name match
  const byId = await supabase.from("scout_players").select("id, full_name").eq("id", match).maybeSingle();
  if (byId.data) return byId.data;
  const byName = await supabase
    .from("scout_players")
    .select("id, full_name")
    .ilike("full_name", `%${match}%`);
  if (byName.error) throw byName.error;
  if (!byName.data.length) throw new Error(`No player matches "${match}"`);
  if (byName.data.length > 1)
    throw new Error(
      `"${match}" matches ${byName.data.length}: ${byName.data.map((p) => p.full_name).join(", ")}`
    );
  return byName.data[0];
}

async function main() {
  const updates = JSON.parse(process.argv[2] || "[]");
  for (const u of updates) {
    const { match, ...stats } = u;
    const player = await findPlayer(match);
    const patch = {};
    for (const k of RAW_KEYS) if (k in stats) patch[k] = stats[k];
    const { error } = await supabase.from("scout_players").update(patch).eq("id", player.id);
    if (error) throw error;
    console.log(`Updated ${player.full_name} (${Object.keys(patch).length} fields)`);
  }

  // recompute all indices with the real engine
  const { data: rows, error } = await supabase.from("scout_players").select("*");
  if (error) throw error;
  const idx = computeIndices(rows.map(toRaw));
  const bulk = rows.map((r, i) => ({
    id: r.id, full_name: r.full_name,
    bat_index: idx[i].bat_index, bowl_index: idx[i].bowl_index,
    field_index: idx[i].field_index, keep_index: idx[i].keep_index,
    overall_index: idx[i].overall_index,
  }));
  const { error: upErr } = await supabase.from("scout_players").upsert(bulk, { onConflict: "id" });
  if (upErr) throw upErr;
  console.log(`Re-ranked ${rows.length} players.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
