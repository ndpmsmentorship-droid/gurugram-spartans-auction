import { createClient } from "@/lib/supabase/server";
import { getActiveSeason, getCurrentProfile } from "@/lib/auth";

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
    .select("sold_price, players(full_name, primary_role)")
    .eq("season_id", season.id)
    .eq("team_id", team.id);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 p-6">
      <h1 className="text-lg font-semibold">{team.name}</h1>
      <p className="mt-1 text-sm text-muted">
        Purse remaining: {team.purse_remaining.toLocaleString()} /{" "}
        {team.purse_total.toLocaleString()}
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Sold price</th>
            </tr>
          </thead>
          <tbody>
            {(roster ?? []).map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-3 py-2 font-medium">
                  {r.players?.full_name}
                </td>
                <td className="px-3 py-2 text-muted">
                  {r.players?.primary_role ?? "—"}
                </td>
                <td className="px-3 py-2">{r.sold_price.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!roster || roster.length === 0) && (
          <p className="p-4 text-center text-muted">No players won yet.</p>
        )}
      </div>
    </div>
  );
}
