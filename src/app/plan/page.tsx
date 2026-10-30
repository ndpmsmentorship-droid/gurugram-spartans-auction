import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuctionSeasonId, AUCTION_DIVISIONS } from "@/lib/auction/target";
import { selectAll } from "@/lib/supabase/select-all";
import OwnerPlan, { type PlanTeam, type PoolPlayer } from "./OwnerPlan";

export const metadata: Metadata = { title: "Plan" };
export const dynamic = "force-dynamic";

// The owner's squad planner: the best squad the purse can still buy for a
// chosen strategy, the playing XII on a field map, and the owner's own calls on
// each player (going for him / hold / reject). Same team rules as the War Room.
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/plan");
  const { team: teamParam } = await searchParams;

  const seasonId = await getAuctionSeasonId();
  const sb = createAdminClient() as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

  const [{ data: teams }, { data: pool }] = await Promise.all([
    sb.from("teams").select("id, name, purse_total, purse_max, owner_profile_id").eq("season_id", seasonId).in("division", AUCTION_DIVISIONS).order("name"),
    selectAll(sb, "scout_players", "id, full_name, auction_category, primary_role, bowling_style, is_keeper, age, bat_matches, runs, bat_avg, bat_sr, wickets, economy, overall_index, team_id, sold_price, is_rejected"),
  ]);

  const list = (teams ?? []) as (PlanTeam & { owner_profile_id: string | null })[];
  const mine =
    (profile.role === "owner" ? list.find((t) => t.owner_profile_id === profile.id) : null) ??
    list.find((t) => t.name === teamParam) ??
    list[0];
  if (!mine) return <main className="mx-auto max-w-[520px] px-4 py-16 text-muted">No teams in the active season yet.</main>;

  return (
    <OwnerPlan
      seasonId={seasonId ?? ""}
      profileId={profile.id}
      team={{ id: mine.id, name: mine.name, purse_total: mine.purse_total, purse_max: mine.purse_max }}
      players={((pool ?? []) as (PoolPlayer & { is_rejected: boolean | null })[]).filter((p) => !p.is_rejected)}
    />
  );
}
