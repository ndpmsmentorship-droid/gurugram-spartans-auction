import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// The live auction runs on the SCCL Elite/Fighters teams (the owners' teams),
// NOT the empty SDLL Group A/B teams. The engine is season-scoped (auction_lot +
// auction_rules per season), so we drive board / console / actions off the SCCL
// S6 season. Resolved by name so no uuid is hard-coded across environments.
export const AUCTION_DIVISIONS = ["Elite", "Fighters"];

export async function getAuctionSeasonId(): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as unknown as { from: (t: string) => any };
  const { data } = await sb
    .from("seasons")
    .select("id, name")
    .ilike("name", "%SARDA%")
    .limit(1);
  return data?.[0]?.id ?? null;
}
