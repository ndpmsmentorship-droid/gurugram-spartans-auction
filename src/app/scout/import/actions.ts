"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseWorkbook, type CleanPlayer } from "@/lib/scout/importer";
import { fetchLeaguePool } from "@/lib/scout/league";
import { computeIndices, type RawStats } from "@/lib/scout/rankings";
import type { ScoutPlayerInsert } from "@/lib/supabase/types";

export type ImportState = {
  ok: boolean;
  message: string;
  imported?: number;
  mapping?: { field: string; header: string }[];
  warnings?: string[];
} | null;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Compute index scores across the whole pool and replace scout_players with it
// (one active pool at a time). Shared by the spreadsheet import and the live
// league sync so both produce identical, ranked rows.
async function replacePool(
  players: CleanPlayer[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const rawForIndex: RawStats[] = players.map((p) => ({
    bat_matches: p.bat_matches,
    bat_innings: p.bat_innings,
    not_out: p.not_out,
    runs: p.runs,
    bat_avg: p.bat_avg,
    bat_sr: p.bat_sr,
    fifties: p.fifties,
    hundreds: p.hundreds,
    fours: p.fours,
    sixes: p.sixes,
    bowl_matches: p.bowl_matches,
    overs: p.overs,
    wickets: p.wickets,
    economy: p.economy,
    bowl_avg: p.bowl_avg,
    bowl_sr: p.bowl_sr,
    dot_balls: p.dot_balls,
    bowl_fours: p.bowl_fours,
    bowl_sixes: p.bowl_sixes,
    five_w: p.five_w,
    catches: p.catches,
    run_outs: p.run_outs,
    is_keeper: p.is_keeper,
    stumpings: p.stumpings,
    keeping_catches: p.keeping_catches,
    primary_role: p.primary_role,
  }));
  const indices = computeIndices(rawForIndex);

  const rows: ScoutPlayerInsert[] = players.map((p, i) => ({
    ...p,
    bat_index: indices[i].bat_index,
    bowl_index: indices[i].bowl_index,
    field_index: indices[i].field_index,
    keep_index: indices[i].keep_index,
    overall_index: indices[i].overall_index,
    is_bought: false,
  }));

  const admin = createAdminClient();
  const { error: delError } = await admin
    .from("scout_players")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delError) return { ok: false, message: `Failed to clear old pool: ${delError.message}` };

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await admin.from("scout_players").insert(rows.slice(i, i + CHUNK));
    if (error) return { ok: false, message: `Import failed at row ${i}: ${error.message}` };
  }

  revalidatePath("/scout");
  revalidatePath("/squad");
  revalidatePath("/");
  return { ok: true };
}

export async function importPool(_prev: ImportState, formData: FormData): Promise<ImportState> {
  if (!(await requireUser())) return { ok: false, message: "You must be signed in to import." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Please choose a .xlsx or .csv file." };
  }

  let parsed;
  try {
    parsed = parseWorkbook(await file.arrayBuffer());
  } catch (err) {
    return { ok: false, message: `Could not read the file: ${(err as Error).message}` };
  }

  if (parsed.players.length === 0) {
    return {
      ok: false,
      message: "No players found. Check the file has a header row and a name column.",
      warnings: parsed.warnings,
    };
  }

  const res = await replacePool(parsed.players);
  if (!res.ok) return { ok: false, message: res.message };

  return {
    ok: true,
    message: `Imported ${parsed.players.length} players and computed their index scores.`,
    imported: parsed.players.length,
    mapping: parsed.mapping,
    warnings: parsed.warnings,
  };
}

// One-click: pull the current registrations straight from the SCCL / anantanity
// dashboard and rebuild the ranked pool. No spreadsheet needed.
export async function syncFromLeague(_prev: ImportState, _formData: FormData): Promise<ImportState> {
  if (!(await requireUser())) return { ok: false, message: "You must be signed in to sync." };

  let pool;
  try {
    pool = await fetchLeaguePool();
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }

  if (pool.players.length === 0) {
    return { ok: false, message: `No players returned for season ${pool.season}.` };
  }

  const res = await replacePool(pool.players);
  if (!res.ok) return { ok: false, message: res.message };

  return {
    ok: true,
    message: `Synced ${pool.fetched} players live from SCCL (season ${pool.season}) and ranked them.`,
    imported: pool.fetched,
  };
}
