import { createClient } from "@/lib/supabase/server";
import { getActiveSeason, getCurrentProfile } from "@/lib/auth";
import MyTeamRoster, { type RosterRow } from "./MyTeamRoster";

export default async function MyTeamPage() {
  const season = await getActiveSeason();
  const profile = await getCurrentProfile();
  if (!season || !profile) {
    return <p className="p-6 text-muted">No active season yet.</p>;
  }

  const supabase = await createClient();
  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("season_id", season.id)
    .eq("owner_profile_id", profile.id)
    .maybeSingle();

  if (!team) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 p-6">
        <p className="text-muted">
          No team is linked to your account yet — ask the admin to assign you
          one.
        </p>
      </div>
    );
  }

  const { data: roster } = await supabase
    .from("roster_entries")
    .select(
      "id, sold_price, is_captain, is_vice_captain, is_keeper, batting_order, " +
        "players(full_name, primary_role)"
    )
    .eq("season_id", season.id)
    .eq("team_id", team.id)
    .order("batting_order", { ascending: true, nullsFirst: false });

  const rows = (roster ?? []) as unknown as RosterRow[];

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 p-6">
      <h1 className="text-lg font-semibold">{team.name}</h1>
      <p className="mt-1 text-sm text-muted">
        Purse remaining: {team.purse_remaining.toLocaleString()} /{" "}
        {team.purse_total.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-muted">
        Set batting order and toggle captain (C), vice-captain (VC) and
        wicketkeeper (WK). Changes show on the public team page.
      </p>

      <MyTeamRoster rows={rows} />
    </div>
  );
}
