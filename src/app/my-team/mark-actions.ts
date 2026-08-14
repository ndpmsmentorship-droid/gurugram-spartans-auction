"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type MarkResult = { error?: string; marked?: boolean };

function friendly(msg: string): string {
  if (/relation .*player_marks.* does not exist|could not find the table/i.test(msg))
    return "Marks aren't set up yet — ask the admin to run supabase/player_marks.sql.";
  return msg;
}

// Toggle a player on/off the current owner's watchlist.
export async function toggleMark(playerId: string): Promise<MarkResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please sign in." };
  if (!playerId) return { error: "No player." };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: existing, error: readErr } = await sb
    .from("player_marks")
    .select("player_id")
    .eq("marker_profile_id", profile.id)
    .eq("player_id", playerId)
    .maybeSingle();
  if (readErr) return { error: friendly(readErr.message) };

  if (existing) {
    const { error } = await sb
      .from("player_marks")
      .delete()
      .eq("marker_profile_id", profile.id)
      .eq("player_id", playerId);
    if (error) return { error: friendly(error.message) };
    revalidatePath("/my-team");
    revalidatePath("/my-team/targets");
    return { marked: false };
  }

  const { error } = await sb
    .from("player_marks")
    .insert({ marker_profile_id: profile.id, player_id: playerId });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/my-team");
  revalidatePath("/my-team/targets");
  return { marked: true };
}
