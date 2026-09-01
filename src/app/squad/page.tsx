import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadRosters } from "@/lib/auction/roster";

// The showcase team. Renaming it in Admin › Teams renames this page's subject
// too, so keep the constant in step if the flagship franchise ever changes.
const SQUAD_TEAM_NAME = "Gurugram Spartans";
import { getCurrentProfile } from "@/lib/auth";
import SquadDisplay, { type SquadCard } from "./SquadDisplay";

export const dynamic = "force-dynamic";

// Public showcase of the final Gurugram Spartans squad (team_id assignments,
// synced from the live auction + any manual additions). Read with the service
// role so it renders without a login.
export default async function SquadPage() {
  // Owners have their own My Squad — keep the Gurugram Spartans showcase out of
  // their portal.
  const profile = await getCurrentProfile();
  if (profile?.role === "owner") redirect("/my-team");

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as unknown as { from: (t: string) => any };
  const { data: season } = await sb.from("seasons").select("id, name").eq("is_active", true).maybeSingle();

  let team: { name: string; logo_url: string | null; purse_total: number } | null = null;
  let squad: SquadCard[] = [];
  if (season) {
    const { data: t } = await sb
      .from("teams")
      .select("id, name, logo_url, purse_total, source_team_id")
      .eq("season_id", season.id)
      .eq("name", SQUAD_TEAM_NAME)
      .maybeSingle();
    if (t) {
      team = { name: t.name, logo_url: t.logo_url ?? null, purse_total: t.purse_total };
      // Own signings plus the borrowed SARDA squad, so the showcase isn't
      // empty while the SDLL pool is still unallocated.
      squad = (await loadRosters(sb, [t], "primary_role, is_keeper, photo_url")) as unknown as SquadCard[];
    }
  }

  // jersey number, display name + kit sizes from the form (table may not exist yet → blank)
  const jerseyByPlayer: Record<string, string | null> = {};
  const displayByPlayer: Record<string, string | null> = {};
  const { data: js } = await sb.from("jersey_sizes").select("player_id, display_name, jersey_number");
  for (const r of js ?? []) {
    jerseyByPlayer[r.player_id] = r.jersey_number;
    displayByPlayer[r.player_id] = r.display_name;
  }

  return (
    <SquadDisplay
      seasonName={season?.name ?? null}
      team={team}
      squad={squad}
      jerseyByPlayer={jerseyByPlayer}
      displayByPlayer={displayByPlayer}
    />
  );
}
