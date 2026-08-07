import { getActiveSeason } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SquadsBoard, { type BoardPlayer, type BoardTeam } from "./SquadsBoard";

export const dynamic = "force-dynamic";

export default async function AuctionPage() {
  const season = await getActiveSeason();
  if (!season) {
    return <p className="p-6 text-muted">No active season yet.</p>;
  }

  const supabase = await createClient();
  // scout_players' new columns aren't in the generated types yet — loose read.
  const sb = supabase as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

  const [{ data: teams }, { data: players }] = await Promise.all([
    sb
      .from("teams")
      .select("id, name, division, purse_total")
      .eq("season_id", season.id)
      .order("name"),
    sb
      .from("scout_players")
      .select("id, full_name, auction_category, team_id, sold_price, acquired")
      .not("team_id", "is", null),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 p-6">
      <SquadsBoard teams={(teams ?? []) as BoardTeam[]} players={(players ?? []) as BoardPlayer[]} />
    </div>
  );
}
