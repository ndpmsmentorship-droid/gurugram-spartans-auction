import { createClient } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/auth";
import PlayerBrowser from "./PlayerBrowser";

export default async function PlayersPage() {
  const season = await getActiveSeason();
  if (!season) {
    return <p className="p-6 text-muted">No active season yet.</p>;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_season_stats")
    .select("*, players(full_name, primary_role, batting_style, bowling_style)")
    .eq("season_id", season.id)
    .order("created_at", { ascending: true });

  if (error) {
    return <p className="p-6 text-danger">Failed to load players: {error.message}</p>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 p-6">
      <h1 className="text-lg font-semibold">Player Pool — {season.name}</h1>
      <PlayerBrowser rows={data} />
    </div>
  );
}
