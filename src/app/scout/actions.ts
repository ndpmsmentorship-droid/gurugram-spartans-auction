"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { utilityTag, type RawStats, type IndexScores } from "@/lib/scout/rankings";
import { recomputeAllIndices } from "@/lib/scout/recompute";
import type { ScoutPlayerInsert } from "@/lib/supabase/types";

// Editable stat/identity fields for the manual + screenshot flows.
export type StatPatch = Partial<
  Pick<
    ScoutPlayerInsert,
    | "primary_role"
    | "age"
    | "is_keeper"
    | "bat_matches"
    | "bat_innings"
    | "not_out"
    | "runs"
    | "bat_avg"
    | "bat_sr"
    | "fifties"
    | "hundreds"
    | "fours"
    | "sixes"
    | "ducks"
    | "bowl_matches"
    | "overs"
    | "wickets"
    | "economy"
    | "bowl_avg"
    | "bowl_sr"
    | "dot_balls"
    | "five_w"
    | "catches"
    | "run_outs"
    | "stumpings"
    | "keeping_catches"
  >
>;

// Save edited stats for one player, then recompute pool-wide indices/ranks.
export async function updatePlayerStats(playerId: string, patch: StatPatch) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scout_players")
    .update(patch)
    .eq("id", playerId);
  if (error) return { error: error.message };

  try {
    await recomputeAllIndices();
  } catch (e) {
    return { error: `Saved, but re-ranking failed: ${(e as Error).message}` };
  }

  revalidatePath("/scout");
  revalidatePath(`/scout/${playerId}`);
  revalidatePath("/squad");
  return { error: null };
}

export async function setScoutingClip(
  playerId: string,
  clipUrl: string | null,
  note: string | null
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scout_players")
    .update({ scouting_clip_url: clipUrl, scouting_note: note })
    .eq("id", playerId);
  if (error) return { error: error.message };
  revalidatePath(`/scout/${playerId}`);
  return { error: null };
}

// Mark a player bought at a price. Derives a utility tag and a suggested batting
// order (bought batters ranked by bat_index -> 1..N) so the squad self-assembles.
export async function markBought(playerId: string, price: number) {
  const supabase = await createClient();

  const { data: player, error: fetchError } = await supabase
    .from("scout_players")
    .select("*")
    .eq("id", playerId)
    .single();
  if (fetchError) return { error: fetchError.message };

  const scores: IndexScores = {
    bat_index: player.bat_index ?? 0,
    bowl_index: player.bowl_index ?? 0,
    field_index: player.field_index ?? 0,
    keep_index: player.keep_index,
    overall_index: player.overall_index ?? 0,
  };
  const raw = player as unknown as RawStats;
  const tag = utilityTag(raw, scores);

  const { error: updateError } = await supabase
    .from("scout_players")
    .update({ is_bought: true, bought_price: price, utility_tag: tag })
    .eq("id", playerId);
  if (updateError) return { error: updateError.message };

  await recomputeBattingOrder();

  revalidatePath("/scout");
  revalidatePath("/squad");
  revalidatePath("/");
  return { error: null };
}

export async function unmarkBought(playerId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scout_players")
    .update({
      is_bought: false,
      bought_price: null,
      suggested_batting_order: null,
      utility_tag: null,
    })
    .eq("id", playerId);
  if (error) return { error: error.message };

  await recomputeBattingOrder();
  revalidatePath("/scout");
  revalidatePath("/squad");
  revalidatePath("/");
  return { error: null };
}

// Wipe every mock buy — one-click reset for the pseudo squad.
export async function clearAllBought() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scout_players")
    .update({
      is_bought: false,
      bought_price: null,
      suggested_batting_order: null,
      utility_tag: null,
    })
    .eq("is_bought", true);
  if (error) return { error: error.message };
  revalidatePath("/scout");
  revalidatePath("/squad");
  revalidatePath("/");
  return { error: null };
}

// Re-number suggested batting order across ALL bought players by bat_index.
async function recomputeBattingOrder() {
  const supabase = await createClient();
  const { data: bought } = await supabase
    .from("scout_players")
    .select("id, bat_index")
    .eq("is_bought", true);
  if (!bought) return;

  const ordered = [...bought].sort(
    (a, b) => (b.bat_index ?? 0) - (a.bat_index ?? 0)
  );
  for (let i = 0; i < ordered.length; i++) {
    await supabase
      .from("scout_players")
      .update({ suggested_batting_order: i + 1 })
      .eq("id", ordered[i].id);
  }
}

// Disqualify a player (removed from the board / never a bid target) or restore.
export async function setRejected(playerId: string, rejected: boolean) {
  const supabase = await createClient();
  const update = rejected
    ? { is_rejected: true, is_bought: false, bought_price: null }
    : { is_rejected: false };
  const { error } = await supabase
    .from("scout_players")
    .update(update)
    .eq("id", playerId);
  if (error) return { error: error.message };
  revalidatePath("/scout");
  revalidatePath("/squad");
  revalidatePath("/");
  return { error: null };
}

export async function setUtilityTag(playerId: string, tag: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scout_players")
    .update({ utility_tag: tag })
    .eq("id", playerId);
  if (error) return { error: error.message };
  revalidatePath("/squad");
  return { error: null };
}

// Manually override a player's fine category (Top Order, Fast Bowler, …). Pass
// null to clear the override and fall back to the auto-derived category.
// Requires the scout_category column (supabase/scout_category.sql).
export async function setCategory(playerId: string, category: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scout_players")
    .update({ scout_category: category })
    .eq("id", playerId);
  if (error) return { error: error.message };
  revalidatePath("/scout");
  revalidatePath(`/scout/${playerId}`);
  revalidatePath("/squad");
  return { error: null };
}

// Set a player's auction-day registration status. Keeps the legacy is_rejected
// boolean in sync so existing pool logic keeps working. Requires the reg_status
// column (supabase/registration_status.sql).
export type RegStatus = "registered" | "verified" | "rejected";

export async function setRegStatus(playerId: string, status: RegStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scout_players")
    .update({ reg_status: status, is_rejected: status === "rejected" })
    .eq("id", playerId);
  if (error) return { error: error.message };
  revalidatePath("/scout");
  revalidatePath(`/scout/${playerId}`);
  revalidatePath("/squad");
  return { error: null };
}

// Flag/unflag a player as a marquee ("must buy") target. Shown as a gold card
// on the squad page. Requires the is_marquee column (supabase/scout_category.sql).
export async function setMarquee(playerId: string, marquee: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scout_players")
    .update({ is_marquee: marquee })
    .eq("id", playerId);
  if (error) return { error: error.message };
  revalidatePath("/scout");
  revalidatePath("/squad");
  return { error: null };
}

export async function setBattingOrder(playerId: string, order: number | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scout_players")
    .update({ suggested_batting_order: order })
    .eq("id", playerId);
  if (error) return { error: error.message };
  revalidatePath("/squad");
  return { error: null };
}
