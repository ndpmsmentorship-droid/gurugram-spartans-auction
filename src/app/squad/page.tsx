import { createAdminClient } from "@/lib/supabase/admin";
import SquadDisplay, { type SquadCard } from "./SquadDisplay";

export const dynamic = "force-dynamic";

// Public showcase of the final Gurugram Spartans squad (team_id assignments,
// synced from the live auction + any manual additions). Read with the service
// role so it renders without a login.
export default async function SquadPage() {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as unknown as { from: (t: string) => any };
  const { data: season } = await sb.from("seasons").select("id").eq("is_active", true).maybeSingle();

  let team: { name: string; purse_total: number } | null = null;
  let squad: SquadCard[] = [];
  if (season) {
    const { data: t } = await sb
      .from("teams")
      .select("id, name, purse_total")
      .eq("season_id", season.id)
      .eq("name", "Gurugram Spartans")
      .maybeSingle();
    if (t) {
      team = { name: t.name, purse_total: t.purse_total };
      const { data } = await sb
        .from("scout_players")
        .select("id, full_name, auction_category, primary_role, is_keeper, acquired, sold_price, photo_url, overall_index")
        .eq("team_id", t.id);
      squad = (data ?? []) as SquadCard[];
    }
  }

  // jersey numbers (table may not exist yet → fall back to blank)
  const jerseyByPlayer: Record<string, string | null> = {};
  const { data: js } = await sb.from("jersey_sizes").select("player_id, jersey_number");
  for (const r of js ?? []) jerseyByPlayer[r.player_id] = r.jersey_number;

  // overall rank in the whole pool, by our ranking system (higher index = better)
  const rankByPlayer: Record<string, number> = {};
  const { data: ranked } = await sb.from("scout_players").select("id, overall_index").not("overall_index", "is", null);
  (ranked ?? [])
    .slice()
    .sort((x: { overall_index: number }, y: { overall_index: number }) => y.overall_index - x.overall_index)
    .forEach((r: { id: string }, i: number) => {
      rankByPlayer[r.id] = i + 1;
    });

  return <SquadDisplay team={team} squad={squad} jerseyByPlayer={jerseyByPlayer} rankByPlayer={rankByPlayer} />;
}
