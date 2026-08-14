import { createAdminClient } from "@/lib/supabase/admin";
import { emailToUsername } from "@/lib/owner-auth";
import OwnersManager, { type TeamRow } from "./OwnersManager";

export const dynamic = "force-dynamic";

// Team-owner logins. The owner experience runs on the SCCL Elite + Fighters
// squads (real rosters, full stats), so those are the teams we hand out here.
const DIVISIONS = ["Elite", "Fighters"];

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function OwnersPage() {
  const admin = createAdminClient();
  const sb = admin as unknown as { from: (t: string) => any };

  const { data: teams } = await sb
    .from("teams")
    .select("id, name, division, owner_profile_id")
    .in("division", DIVISIONS)
    .order("division")
    .order("name");

  // squad size per team (from the SCCL archive)
  const { data: sq } = await sb
    .from("sccl_s6_players")
    .select("team_id")
    .not("team_id", "is", null);
  const counts = new Map<string, number>();
  (sq ?? []).forEach((r: { team_id: string }) =>
    counts.set(r.team_id, (counts.get(r.team_id) || 0) + 1)
  );

  // resolve existing owners → display name + username (from the auth email)
  const ownerIds = (teams ?? [])
    .map((t: any) => t.owner_profile_id)
    .filter(Boolean) as string[];
  const ownerById = new Map<string, { name: string; username: string }>();
  if (ownerIds.length) {
    const { data: profs } = await sb
      .from("profiles")
      .select("id, display_name")
      .in("id", ownerIds);
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emailById = new Map<string, string>(
      (list?.users ?? []).map((u: any) => [u.id as string, (u.email ?? "") as string])
    );
    (profs ?? []).forEach((p: any) =>
      ownerById.set(p.id, {
        name: p.display_name,
        username: emailToUsername(emailById.get(p.id) || ""),
      })
    );
  }

  const rows: TeamRow[] = (teams ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    division: t.division,
    squad: counts.get(t.id) ?? 0,
    owner: t.owner_profile_id
      ? {
          id: t.owner_profile_id as string,
          ...(ownerById.get(t.owner_profile_id) ?? { name: "—", username: "—" }),
        }
      : null,
  }));

  return (
    <div>
      <p className="eyebrow">Admin</p>
      <h1 className="mt-2 font-display text-2xl font-bold">Team owners</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Create a login for each team owner. They sign in at{" "}
        <span className="num">/login</span> with their username &amp; password and land on{" "}
        <span className="num">My Squad</span> — their team&rsquo;s roster and insights. Owner
        squads use the SCCL Elite &amp; Fighters rosters; the live SDLL auction board is separate.
      </p>
      <OwnersManager rows={rows} />
    </div>
  );
}
