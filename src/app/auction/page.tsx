import { createClient } from "@/lib/supabase/server";
import { getActiveSeason, getCurrentProfile } from "@/lib/auth";
import LiveAuction from "./LiveAuction";

export default async function AuctionPage() {
  const season = await getActiveSeason();
  const profile = await getCurrentProfile();
  if (!season || !profile) {
    return <p className="p-6 text-muted">No active season yet.</p>;
  }

  const supabase = await createClient();

  const [{ data: auctionState }, { data: teams }] = await Promise.all([
    supabase.from("auction_state").select("*").eq("season_id", season.id).single(),
    supabase
      .from("teams")
      .select("id, name, is_mock, purse_total, purse_remaining, owner_profile_id")
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

  const myTeam = teams?.find((t) => t.owner_profile_id === profile.id) ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 p-6">
      <LiveAuction
        seasonId={season.id}
        isAdmin={profile.role === "admin"}
        myTeamId={myTeam?.id ?? null}
        teams={teams ?? []}
        initialAuctionState={auctionState!}
        initialCurrentPlayer={currentPlayer ?? null}
      />
    </div>
  );
}
