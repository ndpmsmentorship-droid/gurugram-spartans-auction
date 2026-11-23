import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuctionSeasonId, AUCTION_DIVISIONS } from "@/lib/auction/target";

/** The auction-season team a signed-in owner owns, or null (admins and everyone else). */
export async function ownTeam(profile: { id: string; role: string } | null): Promise<{ id: string; name: string } | null> {
  if (!profile || profile.role !== "owner") return null;
  const seasonId = await getAuctionSeasonId();
  if (!seasonId) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;
  const { data } = await sb
    .from("teams")
    .select("id, name")
    .eq("season_id", seasonId)
    .in("division", AUCTION_DIVISIONS)
    .eq("owner_profile_id", profile.id)
    .maybeSingle();
  return data ?? null;
}
