"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PlayerStatus } from "@/lib/supabase/types";

export async function updatePlayerAuctionInfo(
  statsId: string,
  updates: {
    category?: string | null;
    base_price?: number;
    min_price?: number;
    status?: PlayerStatus;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("player_season_stats")
    .update(updates)
    .eq("id", statsId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/players");
}
