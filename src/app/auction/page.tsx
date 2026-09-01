import { createAdminClient } from "@/lib/supabase/admin";
import { readLiveLot } from "@/lib/auction/read";
import { getAuctionSeasonId, AUCTION_DIVISIONS } from "@/lib/auction/target";
import { loadRosters } from "@/lib/auction/roster";
import SquadsBoard, { type BoardPlayer, type BoardTeam } from "./SquadsBoard";
import type { BlockState } from "./OnTheBlock";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Public live board. The auction runs on the SCCL Elite/Fighters teams (the
// owners' teams); each card shows that team's real SCCL squad, plus anything
// bought in the live auction. The on-the-block lot draws from the player pool.
export default async function AuctionPage() {
  const admin = createAdminClient();
  const sb = admin as unknown as { from: (t: string) => any };

  const seasonId = await getAuctionSeasonId();
  if (!seasonId) {
    return <p className="p-6 text-muted">Auction season not found.</p>;
  }

  const { data: teams } = await sb
    .from("teams")
    .select("id, name, division, logo_url, purse_total, source_team_id")
    .eq("season_id", seasonId)
    .in("division", AUCTION_DIVISIONS)
    .order("name");

  // Squads are borrowed from the SARDA archive per team (prototype) and merged
  // with anything genuinely bought in the live auction.
  const roster = await loadRosters(sb, (teams ?? []) as any[], "cricheroes_link");

  // A card only earns a slot if there is a squad behind it: a borrowed SARDA
  // squad (source_team_id) or players genuinely bought in this auction. Lucknow
  // Strikers and Bhojpuri Dabangs have no SARDA counterpart, so they sit out the
  // board while staying real franchises everywhere else (they keep their
  // fixtures and points-table rows on /schedule under their own names).
  const boardTeams = ((teams ?? []) as any[]).filter(
    (t) => t.source_team_id != null || roster.some((p: any) => p.team_id === t.id)
  );

  // our rank across everyone shown (1 = best by overall index)
  const rankMap = new Map<string, number>();
  roster
    .filter((p: any) => p.overall_index != null)
    .sort((a: any, b: any) => b.overall_index - a.overall_index)
    .forEach((p: any, i: number) => rankMap.set(p.id, i + 1));

  const players: BoardPlayer[] = roster.map((p: any) => ({
    id: p.id,
    full_name: p.full_name,
    auction_category: p.auction_category,
    cricheroes_link: p.cricheroes_link ?? null,
    team_id: p.team_id,
    sold_price: p.sold_price,
    acquired: p.acquired,
    overall_rank: rankMap.get(p.id) ?? null,
  }));

  // ---- what's on the block right now (from the player pool) ----
  const poolRankMap = new Map<string, number>();
  const { data: ranked } = await sb
    .from("scout_players")
    .select("id, overall_index")
    .not("overall_index", "is", null);
  (ranked ?? [])
    .slice()
    .sort((a: any, b: any) => b.overall_index - a.overall_index)
    .forEach((r: any, i: number) => poolRankMap.set(r.id, i + 1));

  const lot = await readLiveLot(seasonId);
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
      .select(
        "id, full_name, auction_category, primary_role, overall_index, is_marquee, " +
          "photo_url, age, bat_matches, runs, bat_avg, bat_sr, wickets, economy, bat_index, bowl_index"
      )
      .eq("id", lot.player_id)
      .maybeSingle();
    if (lp) {
      block = {
        ...block,
        player: { ...lp, overall_rank: poolRankMap.get(lp.id) ?? null },
        leadingTeam:
          (boardTeams as BoardTeam[]).find((t) => t.id === lot.leading_team_id)?.name ?? null,
      };
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-8 sm:px-7">
      <SquadsBoard teams={boardTeams as BoardTeam[]} players={players} block={block} />
    </div>
  );
}
