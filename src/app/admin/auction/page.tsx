import { getActiveSeason } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AuctionConsole, { type ConsolePlayer, type ConsoleTeam } from "./AuctionConsole";

export const dynamic = "force-dynamic";

export default async function AdminAuctionPage() {
  const season = await getActiveSeason();
  if (!season) {
    return <p className="text-muted">No active season yet.</p>;
  }

  const supabase = await createClient();
  // scout_players' new columns aren't in the generated types yet — loose read.
  const sb = supabase as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

  const [{ data: teams }, { data: players }] = await Promise.all([
    sb
      .from("teams")
      .select("id, name, division, purse_total, purse_max")
      .eq("season_id", season.id)
      .order("name"),
    sb
      .from("scout_players")
      .select("id, full_name, auction_category, primary_role, is_keeper, team_id, sold_price, acquired")
      .order("full_name"),
  ]);

  return (
    <AuctionConsole
      teams={(teams ?? []) as ConsoleTeam[]}
      players={(players ?? []) as ConsolePlayer[]}
    />
  );
}
