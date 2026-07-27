"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { utilityTag, type RawStats, type IndexScores } from "@/lib/scout/rankings";

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
