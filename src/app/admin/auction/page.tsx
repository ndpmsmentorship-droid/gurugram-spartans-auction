import { createClient } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/auth";
import AuctionConsole from "./AuctionConsole";

export default async function AdminAuctionPage() {
  const season = await getActiveSeason();
  if (!season) {
    return <p className="text-muted">No active season yet. Run the seed script first.</p>;
  }

  const supabase = await createClient();

  const [{ data: auctionState }, { data: pool }, { data: teams }] = await Promise.all([
    supabase.from("auction_state").select("*").eq("season_id", season.id).single(),
    supabase
      .from("player_season_stats")
      .select("id, player_id, category, base_price, status, players(full_name)")
      .eq("season_id", season.id)
      .eq("status", "in_pool")
      .order("category"),
    supabase
      .from("teams")
      .select("id, name, is_mock, purse_total, purse_remaining")
      .eq("season_id", season.id)
      .order("name"),
  ]);

  const { data: currentPlayer } = auctionState?.current_player_id
    ? await supabase
        .from("player_season_stats")
        .select("*, players(*)")
        .eq("season_id", season.id)
        .eq("player_id", auctionState.current_player_id)
        .single()
    : { data: null };

  return (
    <AuctionConsole
      seasonId={season.id}
      auctionState={auctionState!}
      pool={pool ?? []}
      teams={teams ?? []}
      currentPlayer={currentPlayer ?? null}
    />
  );
}
