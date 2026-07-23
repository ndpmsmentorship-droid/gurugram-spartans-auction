"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AuctionStatus } from "@/lib/supabase/types";

export async function setAuctionStatus(seasonId: string, status: AuctionStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("auction_state")
    .update({ status })
    .eq("season_id", seasonId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/auction");
  revalidatePath("/auction");
}

export async function advanceToPlayer(seasonId: string, playerId: string) {
  const supabase = await createClient();

  const { data: stats, error: statsError } = await supabase
    .from("player_season_stats")
    .select("base_price")
    .eq("season_id", seasonId)
    .eq("player_id", playerId)
    .single();
  if (statsError) throw new Error(statsError.message);

  const { error } = await supabase
    .from("auction_state")
    .update({
      current_player_id: playerId,
      current_bid_amount: stats.base_price,
      current_leading_team_id: null,
    })
    .eq("season_id", seasonId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/auction");
  revalidatePath("/auction");
}

export async function settleCurrentPlayer(seasonId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_current_player_settled", {
    p_season_id: seasonId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/auction");
  revalidatePath("/admin/players");
  revalidatePath("/auction");
  revalidatePath("/my-team");
}
