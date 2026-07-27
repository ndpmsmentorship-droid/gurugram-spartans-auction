"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type SquadRole = "captain" | "vice_captain" | "keeper";

type RosterUpdate = Database["public"]["Tables"]["roster_entries"]["Update"];

function roleUpdate(role: SquadRole, value: boolean): RosterUpdate {
  switch (role) {
    case "captain":
      return { is_captain: value };
    case "vice_captain":
      return { is_vice_captain: value };
    case "keeper":
      return { is_keeper: value };
  }
}

// Toggle a squad role on a roster entry. Captain and vice-captain are
// single-holder: setting one clears it on the rest of the team first.
export async function setSquadRole(
  rosterEntryId: string,
  role: SquadRole,
  value: boolean
) {
  const supabase = await createClient();

  const { data: entry, error: entryError } = await supabase
    .from("roster_entries")
    .select("id, team_id, season_id")
    .eq("id", rosterEntryId)
    .single();
  if (entryError) throw new Error(entryError.message);

  if (value && role !== "keeper") {
    const { error: clearError } = await supabase
      .from("roster_entries")
      .update(roleUpdate(role, false))
      .eq("team_id", entry.team_id)
      .eq("season_id", entry.season_id);
    if (clearError) throw new Error(clearError.message);
  }

  const { error } = await supabase
    .from("roster_entries")
    .update(roleUpdate(role, value))
    .eq("id", rosterEntryId);
  if (error) throw new Error(error.message);

  revalidatePath("/my-team");
  revalidatePath("/team");
}

export async function setBattingOrder(
  rosterEntryId: string,
  order: number | null
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("roster_entries")
    .update({ batting_order: order })
    .eq("id", rosterEntryId);
  if (error) throw new Error(error.message);

  revalidatePath("/my-team");
  revalidatePath("/team");
}
