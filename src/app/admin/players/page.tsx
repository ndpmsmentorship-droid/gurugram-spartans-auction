import { createClient } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/auth";
import PlayersTable from "./PlayersTable";

export default async function AdminPlayersPage() {
  const season = await getActiveSeason();
  if (!season) {
    return <p className="text-muted">No active season yet. Run the seed script first.</p>;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_season_stats")
    .select("*, players(full_name, primary_role, batting_style, bowling_style)")
    .eq("season_id", season.id)
    .order("created_at", { ascending: true });

  if (error) {
    return <p className="text-danger">Failed to load players: {error.message}</p>;
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">Player Pool — {season.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {data.length} registered players. Assign category, base price and status
        before the auction goes live.
      </p>
      <PlayersTable rows={data} />
    </div>
  );
}
