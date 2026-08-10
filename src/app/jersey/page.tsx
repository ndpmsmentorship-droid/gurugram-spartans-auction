import { createAdminClient } from "@/lib/supabase/admin";
import JerseyForm, { type JerseyPlayer } from "./JerseyForm";

export const dynamic = "force-dynamic";

// Public kit-size collection form (not linked in nav — shared directly with players).
export default async function JerseyPage() {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as unknown as { from: (t: string) => any };
  const { data: season } = await sb.from("seasons").select("id").eq("is_active", true).maybeSingle();

  let players: JerseyPlayer[] = [];
  if (season) {
    const { data: t } = await sb
      .from("teams")
      .select("id")
      .eq("season_id", season.id)
      .eq("name", "Gurugram Spartans")
      .maybeSingle();
    if (t) {
      const { data: squad } = await sb
        .from("scout_players")
        .select("id, full_name")
        .eq("team_id", t.id)
        .order("full_name");
      // existing submissions (table may not exist yet → ignore error)
      const { data: js } = await sb.from("jersey_sizes").select("player_id, jersey_number, tshirt_size, lower_size");
      const jmap = new Map((js ?? []).map((r: { player_id: string }) => [r.player_id, r]));
      players = (squad ?? []).map((p: { id: string; full_name: string }) => ({
        id: p.id,
        full_name: p.full_name,
        ...(jmap.get(p.id) ?? {}),
      }));
    }
  }

  return <JerseyForm players={players} />;
}
