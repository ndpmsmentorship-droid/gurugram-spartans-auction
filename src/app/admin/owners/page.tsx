import { createAdminClient } from "@/lib/supabase/admin";
import { emailToUsername } from "@/lib/owner-auth";
import { getAuctionSeasonId, AUCTION_DIVISIONS } from "@/lib/auction/target";
import OwnersManager, { type TeamRow } from "./OwnersManager";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function OwnersPage() {
  const admin = createAdminClient();
  const sb = admin as unknown as { from: (t: string) => any };

  // Owner logins must list exactly the teams the auction runs on, otherwise
  // this page and /my-team disagree about who owns what. Both now resolve
  // through lib/auction/target.ts, so repointing the prototype at a different
  // season is a one-file change rather than a hunt through every surface.
  // (It previously filtered divisions with NO season filter at all.)
  const seasonId = await getAuctionSeasonId();

  const { data: teams } = await sb
    .from("teams")
    .select("id, name, division, logo_url, owner_profile_id")
    .eq("season_id", seasonId ?? "")
    .in("division", AUCTION_DIVISIONS)
    .eq("is_mock", false)
    .order("division")
    .order("name");

  // Squad sizes from the archive the auction prototype runs on.
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
    logoUrl: t.logo_url ?? null,
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
        <span className="num">My Squad</span> — their team&rsquo;s roster and insights. Names and
        logos come from{" "}
        <a href="/admin/teams" className="underline underline-offset-2 hover:text-red">
          Admin &rsaquo; Teams
        </a>
        , so rename a franchise there and it updates here too.
      </p>
      <OwnersManager rows={rows} />
    </div>
  );
}
