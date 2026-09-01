import type { FixtureRow } from "@/lib/supabase/types";

/**
 * Group points tables, derived from fixture results.
 *
 * Standings are never stored — they're recomputed from `fixtures` on every
 * read. One source of truth means a corrected result can't leave a stale table
 * behind, and at 30 matches the cost is nil.
 *
 * Points: win 2, tie 1, no result / abandoned 1, loss 0 — the usual T20 league
 * ladder. Net run rate isn't computed: scores are entered as free text
 * ("164/6"), which isn't enough to derive overs faced. NRR ties are broken by
 * wins, then head-to-head is left to the organisers.
 */

export type StandingRow = {
  teamId: string;
  name: string;
  group: string;
  logoUrl: string | null;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
};

export type TeamLite = {
  id: string;
  name: string;
  group: string;
  /** Public Storage URL set in Admin › Teams; null falls back to initials. */
  logoUrl?: string | null;
};

export function computeStandings(
  fixtures: FixtureRow[],
  teams: TeamLite[]
): Map<string, StandingRow[]> {
  const rows = new Map<string, StandingRow>();
  for (const t of teams) {
    rows.set(t.id, {
      teamId: t.id,
      name: t.name,
      group: t.group,
      logoUrl: t.logoUrl ?? null,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      noResult: 0,
      points: 0,
    });
  }

  for (const f of fixtures) {
    if (f.stage !== "group") continue;
    if (f.status === "scheduled") continue;
    const home = f.home_team_id ? rows.get(f.home_team_id) : null;
    const away = f.away_team_id ? rows.get(f.away_team_id) : null;
    if (!home || !away) continue;

    home.played++;
    away.played++;

    if (f.status === "no_result" || f.status === "abandoned") {
      home.noResult++;
      away.noResult++;
      home.points += 1;
      away.points += 1;
      continue;
    }

    // completed
    if (!f.winner_team_id) {
      home.tied++;
      away.tied++;
      home.points += 1;
      away.points += 1;
      continue;
    }
    const winner = f.winner_team_id === home.teamId ? home : away;
    const loser = winner === home ? away : home;
    winner.won++;
    winner.points += 2;
    loser.lost++;
  }

  const byGroup = new Map<string, StandingRow[]>();
  for (const row of rows.values()) {
    if (!byGroup.has(row.group)) byGroup.set(row.group, []);
    byGroup.get(row.group)!.push(row);
  }
  for (const list of byGroup.values()) {
    list.sort(
      (a, b) => b.points - a.points || b.won - a.won || a.name.localeCompare(b.name)
    );
  }

  return new Map([...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

/**
 * Resolve knockout placeholders once the group tables are settled.
 * Returns a label→team-name map, e.g. "Winner Group A" → "Bengal Tigers".
 * Only fills a slot when every group match has a result, so a half-played
 * table can't put a team into a semi-final it hasn't earned.
 */
export function resolveBracketLabels(
  fixtures: FixtureRow[],
  standings: Map<string, StandingRow[]>
): Map<string, string> {
  const out = new Map<string, string>();
  const groupFixtures = fixtures.filter((f) => f.stage === "group");
  const allPlayed =
    groupFixtures.length > 0 &&
    groupFixtures.every((f) => f.status !== "scheduled");
  if (!allPlayed) return out;

  for (const [group, table] of standings) {
    if (table[0]) out.set(`Winner ${group}`, table[0].name);
    if (table[1]) out.set(`Runner-up ${group}`, table[1].name);
  }
  return out;
}
