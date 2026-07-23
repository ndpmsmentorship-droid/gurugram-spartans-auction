"use server";

import { createClient } from "@/lib/supabase/server";

export async function placeBid(seasonId: string, teamId: string, amount: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("place_bid", {
    p_season_id: seasonId,
    p_team_id: teamId,
    p_amount: amount,
  });
  if (error) return { error: error.message };
  return { error: null };
}
