import type { FixtureRow } from "@/lib/supabase/types";
import type { TeamLite } from "./standings";

export type Staleness =
  | { stale: false }
  | { stale: true; reasons: string[] };

/**
 * Does the current team list still match the schedule that was generated?
 *
 * Renames and logo changes are invisible here on purpose — fixtures reference
 * teams by id, so those flow through on their own and must not raise a false
 * alarm. What genuinely invalidates a draw is the *shape* of the groups: a
 * team joining, leaving, or swapping groups changes who should be playing
 * whom.
 */
export function scheduleStaleness(
  fixtures: FixtureRow[],
  teams: TeamLite[]
): Staleness {
  const group = fixtures.filter((f) => f.stage === "group");
  if (group.length === 0) return { stale: false };

  const reasons: string[] = [];

  // What the fixtures believe each team's group is.
  const scheduled = new Map<string, string>();
  for (const f of group) {
    for (const id of [f.home_team_id, f.away_team_id]) {
      if (id && f.group_name) scheduled.set(id, f.group_name);
    }
  }

  const current = new Map(teams.map((t) => [t.id, t]));

  for (const [id, grp] of scheduled) {
    const team = current.get(id);
    if (!team) {
      reasons.push("A team in the schedule no longer exists.");
      continue;
    }
    if (team.group !== grp) {
      reasons.push(`${team.name} moved from ${grp} to ${team.group}.`);
    }
  }

  for (const t of teams) {
    if (!scheduled.has(t.id)) reasons.push(`${t.name} has no fixtures.`);
  }

  // Collapse duplicates from the "no longer exists" branch.
  const unique = [...new Set(reasons)];
  return unique.length ? { stale: true, reasons: unique } : { stale: false };
}
