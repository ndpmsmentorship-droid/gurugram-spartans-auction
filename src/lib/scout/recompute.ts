import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeIndices, type RawStats } from "./rankings";
import type { ScoutPlayerRow } from "@/lib/supabase/types";

// Map a stored row to the RawStats shape the ranking engine expects.
function toRawStats(r: ScoutPlayerRow): RawStats {
  return {
    bat_matches: r.bat_matches,
    bat_innings: r.bat_innings,
    not_out: r.not_out,
    runs: r.runs,
    bat_avg: r.bat_avg,
    bat_sr: r.bat_sr,
    fifties: r.fifties,
    hundreds: r.hundreds,
    fours: r.fours,
    sixes: r.sixes,
    bowl_matches: r.bowl_matches,
    overs: r.overs,
    wickets: r.wickets,
    economy: r.economy,
    bowl_avg: r.bowl_avg,
    bowl_sr: r.bowl_sr,
    dot_balls: r.dot_balls,
    five_w: r.five_w,
    catches: r.catches,
    run_outs: r.run_outs,
    is_keeper: r.is_keeper,
    stumpings: r.stumpings,
    keeping_catches: r.keeping_catches,
    primary_role: r.primary_role,
  };
}

// Recompute every player's index scores (percentiles are pool-wide, so one
// player's edit shifts everyone slightly). Single bulk upsert = one round trip.
export async function recomputeAllIndices() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("scout_players").select("*");
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ScoutPlayerRow[];
  if (rows.length === 0) return;

  const indices = computeIndices(rows.map(toRawStats));
  const updates = rows.map((r, i) => ({
    id: r.id,
    full_name: r.full_name, // required NOT NULL column for upsert
    bat_index: indices[i].bat_index,
    bowl_index: indices[i].bowl_index,
    field_index: indices[i].field_index,
    keep_index: indices[i].keep_index,
    overall_index: indices[i].overall_index,
  }));

  const { error: upsertError } = await admin
    .from("scout_players")
    .upsert(updates, { onConflict: "id" });
  if (upsertError) throw new Error(upsertError.message);
}
