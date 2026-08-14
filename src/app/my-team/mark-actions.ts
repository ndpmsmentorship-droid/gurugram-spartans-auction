"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type MarkResult = { error?: string; marked?: boolean };

function friendly(msg: string): string {
  if (/relation .*player_marks.* does not exist|could not find the table/i.test(msg))
    return "Marks aren't set up yet — ask the admin to run supabase/player_marks.sql.";
  if (/foreign key|violates foreign key|player_marks_player_id_fkey/i.test(msg))
    return "Marks need a quick update — ask the admin to run supabase/player_marks_repoint_sccl.sql.";
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

  // Delete-first and let the DB tell us what actually happened via .select():
  // idempotent, no read/write race, and immune to a stale "existing" read.
  const { data: removed, error: delErr } = await sb
    .from("player_marks")
    .delete()
    .eq("marker_profile_id", profile.id)
    .eq("player_id", playerId)
    .select("player_id");
  if (delErr) return { error: friendly(delErr.message) };

  if (removed && removed.length > 0) {
    revalidatePath("/my-team");
    revalidatePath("/my-team/targets");
    return { marked: false };
  }

  // Nothing was there to remove → add it. Upsert so a concurrent double-click
  // can't 409 on the primary key.
  const { error: insErr } = await sb
    .from("player_marks")
    .upsert(
      { marker_profile_id: profile.id, player_id: playerId },
      { onConflict: "marker_profile_id,player_id" }
    );
  if (insErr) return { error: friendly(insErr.message) };
  revalidatePath("/my-team");
  revalidatePath("/my-team/targets");
  return { marked: true };
}
