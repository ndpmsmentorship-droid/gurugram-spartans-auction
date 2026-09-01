import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuctionSeasonId } from "./target";

/**
 * Is a lot actually on the block right now?
 *
 * The masthead badge used to be hardcoded to "Auction Live", which read as a
 * live auction even months out from one. It now follows `auction_lot.status`.
 * Failures resolve to false: claiming a live auction that isn't happening is
 * worse than missing a badge during one.
 */
export async function isAuctionLive(): Promise<boolean> {
  try {
    const seasonId = await getAuctionSeasonId();
    if (!seasonId) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as unknown as { from: (t: string) => any };
    const { data } = await sb
      .from("auction_lot")
      .select("status")
      .eq("season_id", seasonId)
      .maybeSingle();
    return data?.status === "live";
  } catch {
    return false;
  }
}
