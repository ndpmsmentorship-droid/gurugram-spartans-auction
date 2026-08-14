import { getActiveSeason } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readLiveLot } from "@/lib/auction/read";
import { rankPlayers } from "@/lib/scout/ranks";
import { normCategory } from "@/lib/scout/tier";
import type { ScoutPlayerRow } from "@/lib/supabase/types";
import AuctionConsole, { type ConsolePlayer, type ConsoleTeam } from "./AuctionConsole";
import LotControl, { type LotPlayer, type LotTeam, type LotView } from "./LotControl";

export const dynamic = "force-dynamic";

export default async function AdminAuctionPage() {
  const season = await getActiveSeason();
  if (!season) {
    return <p className="text-muted">No active season yet.</p>;
  }

  // /admin is gated to admins (admin/layout). Use the service-role client so the
  // console isn't blocked by RLS. scout_players' new columns aren't typed yet.
  const supabase = createAdminClient();
  const sb = supabase as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

  const [{ data: teams }, { data: players }, { data: ranking }] = await Promise.all([
    sb
      .from("teams")
      .select("id, name, division, purse_total, purse_max")
      .eq("season_id", season.id)
      .order("name"),
    sb
      .from("scout_players")
      .select(
        "id, full_name, auction_category, primary_role, is_keeper, age, team_id, sold_price, acquired, is_marquee, " +
          "photo_url, bat_matches, runs, bat_avg, bat_sr, wickets, economy, bat_index, bowl_index, overall_index"
      )
      .order("full_name"),
    // full rows, so the lot control can show each player's overall rank —
    // the auctioneer needs to know if the next lot is a #3 or a #300
    sb.from("scout_players").select("*"),
  ]);

  const rows = (players ?? []) as (ConsolePlayer & { is_marquee: boolean })[];

  const rankMap = new Map<string, number>();
  for (const p of rankPlayers((ranking ?? []) as ScoutPlayerRow[])) {
    rankMap.set(p.id, p.overall_rank);
  }

  // ---- live lot ----
  const lotRow = await readLiveLot(season.id);
  const lotPlayerRow = lotRow.player_id
    ? rows.find((p) => p.id === lotRow.player_id)
    : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toLotPlayer = (p: any): LotPlayer => ({
    id: p.id,
    full_name: p.full_name,
    auction_category: p.auction_category,
    primary_role: p.primary_role,
    overall_rank: rankMap.get(p.id) ?? null,
    is_marquee: !!p.is_marquee,
    photo_url: p.photo_url ?? null,
    age: p.age ?? null,
    bat_matches: p.bat_matches ?? null,
    runs: p.runs ?? null,
    bat_avg: p.bat_avg ?? null,
    bat_sr: p.bat_sr ?? null,
    wickets: p.wickets ?? null,
    economy: p.economy ?? null,
    bat_index: p.bat_index ?? null,
    bowl_index: p.bowl_index ?? null,
    overall_index: p.overall_index ?? null,
  });

  const lot: LotView = {
    status: lotRow.status,
    base_price: lotRow.base_price,
    current_bid: lotRow.current_bid,
    leading_team_id: lotRow.leading_team_id,
    player: lotPlayerRow ? toLotPlayer(lotPlayerRow) : null,
  };

  const spent = new Map<string, number>();
  const size = new Map<string, number>();
  const cats = new Map<string, Record<string, number>>();
  for (const p of rows) {
    if (!p.team_id) continue;
    spent.set(p.team_id, (spent.get(p.team_id) ?? 0) + (Number(p.sold_price) || 0));
    size.set(p.team_id, (size.get(p.team_id) ?? 0) + 1);
    const cat = normCategory(p.auction_category);
    if (cat) {
      const c = cats.get(p.team_id) ?? {};
      c[cat] = (c[cat] ?? 0) + 1;
      cats.set(p.team_id, c);
    }
  }

  const lotTeams: LotTeam[] = ((teams ?? []) as ConsoleTeam[]).map((t) => ({
    id: t.id,
    name: t.name,
    purse_total: t.purse_total,
    spent: spent.get(t.id) ?? 0,
    squadSize: size.get(t.id) ?? 0,
    catCounts: cats.get(t.id) ?? {},
  }));

  const available = rows.filter((p) => !p.team_id).map(toLotPlayer);

  return (
    <div className="flex flex-col gap-8">
      <LotControl lot={lot} teams={lotTeams} available={available} />
      <AuctionConsole
        teams={(teams ?? []) as ConsoleTeam[]}
        players={rows as ConsolePlayer[]}
      />
    </div>
  );
}
