import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Which teams the auction surfaces (board, console, my-team, owner logins) run
 * on — the ONE switch for the whole app.
 *
 * The SDLL Season 2 portal is the product, so these now resolve to the active
 * SDLL season's Group A/B franchises. They previously pointed at the archived
 * SARDA S6 season, which meant renaming an SDLL team changed nothing on the
 * board.
 *
 * SDLL players were imported clean-slate with no stats, so the squads
 * themselves are borrowed from the SARDA archive via `teams.source_team_id`
 * (see supabase/team_source_schema.sql and ./roster.ts). The SARDA data is
 * never modified — Gurugram Spartans are still playing that season.
 */
export const AUCTION_DIVISIONS = ["Group A", "Group B"];

export async function getAuctionSeasonId(): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as unknown as { from: (t: string) => any };
  const { data } = await sb
    .from("seasons")
    .select("id, name")
    .eq("is_active", true)
    .limit(1);
  return data?.[0]?.id ?? null;
}
