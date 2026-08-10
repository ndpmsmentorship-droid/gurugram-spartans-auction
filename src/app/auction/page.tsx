import { createAdminClient } from "@/lib/supabase/admin";
import SquadsBoard, { type BoardPlayer, type BoardTeam } from "./SquadsBoard";

export const dynamic = "force-dynamic";

// Public live board — read with the service-role client so anyone (no login) can
// watch. Read-only; only non-sensitive auction results (teams, sold players).
export default async function AuctionPage() {
  const admin = createAdminClient();
  const sb = admin as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: season } = await admin.from("seasons").select("id").eq("is_active", true).maybeSingle();
  if (!season) {
    return <p className="p-6 text-muted">No active season yet.</p>;
  }

  const [{ data: teams }, { data: players }, { data: ranked }] = await Promise.all([
    sb.from("teams").select("id, name, division, purse_total").eq("season_id", season.id).order("name"),
    sb
      .from("scout_players")
      .select("id, full_name, auction_category, team_id, sold_price, acquired")
      .not("team_id", "is", null),
    // whole pool by index, to derive each player's "Our Rank" (1 = best)
    sb.from("scout_players").select("id, overall_index").not("overall_index", "is", null),
  ]);

  // rank the entire pool by overall index; retained rows without stats stay unranked
  const rankMap = new Map<string, number>();
  (ranked ?? [])
    .slice()
    .sort((a: { overall_index: number }, b: { overall_index: number }) => b.overall_index - a.overall_index)
    .forEach((r: { id: string }, i: number) => rankMap.set(r.id, i + 1));

  const withRank = ((players ?? []) as BoardPlayer[]).map((p) => ({
    ...p,
    overall_rank: rankMap.get(p.id) ?? null,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
      <SquadsBoard teams={(teams ?? []) as BoardTeam[]} players={withRank} />
    </div>
  );
}
