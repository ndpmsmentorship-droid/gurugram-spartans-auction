"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";

// Manually tag a squad player into a position slot ('bowler' | 'middle_order'),
// or null to clear. Admin-only. Requires the squad_slot column (supabase/squad_slot.sql).
export async function setSquadSlot(playerId: string, slot: string | null): Promise<{ error?: string; ok?: boolean }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return { error: "Admins only." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as unknown as { from: (t: string) => any };
  const { error } = await admin.from("scout_players").update({ squad_slot: slot }).eq("id", playerId);
  if (error) {
    return {
      error: error.message.includes("squad_slot")
        ? 'Run supabase/squad_slot.sql in Supabase first (adds the squad_slot column).'
        : error.message,
    };
  }
  revalidatePath("/squad");
  revalidatePath("/auction");
  return { ok: true };
}
