"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// Public kit-size submission (players fill their own via the /jersey link).
// Writes go through the service role so no anon RLS policy is needed.
export async function saveJersey(input: {
  player_id: string;
  full_name: string;
  display_name: string;
  jersey_number: string;
  tshirt_size: string;
  lower_size: string;
}): Promise<{ error?: string; ok?: boolean }> {
  if (!input.player_id) return { error: "Please select your name." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as unknown as { from: (t: string) => any };
  const { error } = await admin.from("jersey_sizes").upsert(
    {
      player_id: input.player_id,
      full_name: input.full_name,
      display_name: input.display_name?.trim() || null,
      jersey_number: input.jersey_number?.trim() || null,
      tshirt_size: input.tshirt_size?.trim() || null,
      lower_size: input.lower_size?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id" },
  );
  if (error) {
    return {
      error: error.message.includes("jersey_sizes")
        ? "Kit form isn't set up yet — run supabase/jersey_sizes.sql in Supabase."
        : error.message,
    };
  }
  revalidatePath("/jersey");
  revalidatePath("/squad");
  return { ok: true };
}
