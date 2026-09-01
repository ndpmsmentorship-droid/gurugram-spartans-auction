import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleStaleness } from "@/lib/schedule/staleness";
import type { FixtureRow } from "@/lib/supabase/types";
import TeamsManager, { type TeamRow, type SourceTeam } from "./TeamsManager";

export const dynamic = "force-dynamic";

/** Offered in the group dropdown even before a team occupies them. */
const BASE_GROUPS = ["Group A", "Group B"];

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function AdminTeamsPage() {
  const admin = createAdminClient();
  // scout_players.team_id post-dates the generated types — same escape hatch
  // the other admin pages use.
  const sb = admin as unknown as { from: (t: string) => any };

  const { data: season } = await admin
    .from("seasons")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  if (!season) {
    return (
      <div>
        <p className="eyebrow">Admin</p>
        <h1 className="mt-2 font-display text-[1.75rem]">Teams</h1>
        <p className="mt-3 text-[0.875rem] text-muted">No active season.</p>
      </div>
    );
  }

  const [{ data: teamRows }, { data: fixtureRows }, { data: squadRows }] =
    await Promise.all([
      admin
        .from("teams")
        .select("id, name, division, logo_url, owner_profile_id, source_team_id")
        .eq("season_id", season.id)
        .eq("is_mock", false)
        .order("division")
        .order("name"),
      admin.from("fixtures").select("*").eq("season_id", season.id),
      sb.from("scout_players").select("team_id").not("team_id", "is", null),
    ]);

  // Teams outside the active season whose archived squads can be borrowed for
  // the prototype (the SARDA S6 franchises), with their squad sizes.
  const { data: sourceRows } = await sb
    .from("teams")
    .select("id, name")
    .neq("season_id", season.id)
    .order("name");
  const { data: archiveRows } = await sb
    .from("sccl_s6_players")
    .select("team_id")
    .not("team_id", "is", null);
  const archiveCount = new Map<string, number>();
  for (const r of (archiveRows ?? []) as { team_id: string }[]) {
    archiveCount.set(r.team_id, (archiveCount.get(r.team_id) ?? 0) + 1);
  }
  const sources: SourceTeam[] = ((sourceRows ?? []) as any[])
    .map((t) => ({ id: t.id, name: t.name, squad: archiveCount.get(t.id) ?? 0 }))
    .filter((t) => t.squad > 0);

  const fixtures = (fixtureRows ?? []) as FixtureRow[];

  // squad size per team
  const squadCount = new Map<string, number>();
  for (const r of (squadRows ?? []) as { team_id: string }[]) {
    const id = r.team_id;
    squadCount.set(id, (squadCount.get(id) ?? 0) + 1);
  }

  // fixture count per team
  const fixtureCount = new Map<string, number>();
  for (const f of fixtures) {
    for (const id of [f.home_team_id, f.away_team_id]) {
      if (id) fixtureCount.set(id, (fixtureCount.get(id) ?? 0) + 1);
    }
  }

  // owner display names
  const ownerIds = (teamRows ?? [])
    .map((t) => t.owner_profile_id)
    .filter(Boolean) as string[];
  const ownerName = new Map<string, string>();
  if (ownerIds.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", ownerIds);
    for (const p of profs ?? []) ownerName.set(p.id, p.display_name);
  }

  const teams: TeamRow[] = (teamRows ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    group: t.division ?? "Unassigned",
    logoUrl: t.logo_url,
    sourceTeamId: t.source_team_id ?? null,
    squad: (squadCount.get(t.id) ?? 0) + (archiveCount.get(t.source_team_id ?? "") ?? 0),
    fixtures: fixtureCount.get(t.id) ?? 0,
    owner: t.owner_profile_id
      ? (ownerName.get(t.owner_profile_id) ?? "—")
      : null,
  }));

  const staleness = scheduleStaleness(
    fixtures,
    teams.map((t) => ({ id: t.id, name: t.name, group: t.group }))
  );

  const groups = [
    ...new Set([...BASE_GROUPS, ...teams.map((t) => t.group)]),
  ].sort();

  return (
    <div>
      <p className="eyebrow">Admin</p>
      <h1 className="mt-2 font-display text-[1.75rem]">Teams</h1>
      <p className="mt-2 text-[0.875rem] text-muted">
        {season.name} &middot; {teams.length} teams
      </p>

      <TeamsManager
        teams={teams}
        groups={groups}
        sources={sources}
        staleReasons={staleness.stale ? staleness.reasons : []}
      />
    </div>
  );
}
