// Import a previously-fetched Sarda league player JSON into scout_players,
// then compute indices. Replaces the current pool. (For a live pull that logs
// in and fetches too, use refresh-sarda.mjs.)
//
//   node --experimental-strip-types --env-file=.env.local \
//     scripts/import-sarda.mjs /path/to/players.json

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { computeIndices } from "../src/lib/scout/rankings.ts";
import { mapPlayer, toRaw } from "./sarda-map.mjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  const raw = JSON.parse(readFileSync(process.argv[2], "utf-8"));
  const rows = raw.map(mapPlayer).filter((r) => r.full_name);
  console.log(`Mapped ${rows.length} players`);

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
  console.log(`Imported ${rows.length} players with index scores.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
