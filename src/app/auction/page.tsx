import { createAdminClient } from "@/lib/supabase/admin";
import { readLiveLot } from "@/lib/auction/read";
import SquadsBoard, { type BoardPlayer, type BoardTeam } from "./SquadsBoard";
import type { BlockState } from "./OnTheBlock";

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

  const [{ data: teams }, { data: players }, { data: ranked }, { count: poolSize }] =
    await Promise.all([
      sb.from("teams").select("id, name, division, purse_total").eq("season_id", season.id).order("name"),
      sb
        .from("scout_players")
        .select("id, full_name, auction_category, team_id, sold_price, acquired")
        .not("team_id", "is", null),
      // whole pool by index, to derive each player's "Our Rank" (1 = best)
      sb.from("scout_players").select("id, overall_index").not("overall_index", "is", null),
      // pool total, so the board can show how many lots are still to come
      sb.from("scout_players").select("id", { count: "exact", head: true }),
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

  // ---- what's on the block right now ----
  const lot = await readLiveLot(season.id);
  let block: BlockState = {
    status: lot.status,
    base_price: lot.base_price,
    current_bid: lot.current_bid,
    leadingTeam: null,
    player: null,
  };
  if (lot.player_id) {
    const { data: lp } = await sb
      .from("scout_players")
      .select("id, full_name, auction_category, primary_role, overall_index, is_marquee")
      .eq("id", lot.player_id)
      .maybeSingle();
    if (lp) {
      block = {
        ...block,
        player: { ...lp, overall_rank: rankMap.get(lp.id) ?? null },
        leadingTeam:
          (teams ?? []).find((t: BoardTeam) => t.id === lot.leading_team_id)?.name ?? null,
      };
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-8 sm:px-7">
      <SquadsBoard
        teams={(teams ?? []) as BoardTeam[]}
        players={withRank}
        poolSize={poolSize ?? undefined}
        block={block}
      />
    </div>
  );
}
