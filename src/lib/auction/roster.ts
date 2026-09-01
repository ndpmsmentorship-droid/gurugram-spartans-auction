import "server-only";

/**
 * Squad borrowing, for the SDLL Season 2 prototype.
 *
 * SDLL's own player pool came in clean-slate with no stats, so a board built
 * on it would be twelve empty cards. Each SDLL team therefore points at a
 * SARDA team (`teams.source_team_id`) whose archived squad it displays.
 *
 * This module does the re-labelling and nothing else: it reads the SARDA
 * archive and hands back the same player rows with `team_id` swapped to the
 * borrowing SDLL team, so every caller downstream can keep treating `team_id`
 * as "the team this player appears under". The archive itself is never written
 * to — SARDA is a live season.
 *
 * Players genuinely bought in the SDLL auction already carry a real SDLL
 * `team_id` and pass through untouched, so a live sale always beats the
 * borrowed stand-in.
 */

export type RosterPlayer = {
  id: string;
  full_name: string;
  auction_category: string | null;
  team_id: string | null;
  sold_price: number | null;
  acquired: string | null;
  overall_index: number | null;
};

const ROSTER_COLS =
  "id, full_name, auction_category, team_id, sold_price, acquired, overall_index";

type TeamWithSource = { id: string; source_team_id?: string | null };

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = { from: (t: string) => any };

/**
 * Rosters for the given teams: their own signings, plus the borrowed squad of
 * whichever team each one sources from.
 */
export async function loadRosters(
  sb: Sb,
  teams: TeamWithSource[],
  extraCols = ""
): Promise<RosterPlayer[]> {
  const cols = extraCols ? `${ROSTER_COLS}, ${extraCols}` : ROSTER_COLS;

  // sourceTeamId -> the SDLL team(s) borrowing it. A list, because two teams
  // could in principle be pointed at the same source.
  const borrowedBy = new Map<string, string[]>();
  for (const t of teams) {
    if (!t.source_team_id) continue;
    const list = borrowedBy.get(t.source_team_id) ?? [];
    list.push(t.id);
    borrowedBy.set(t.source_team_id, list);
  }

  const ownIds = new Set(teams.map((t) => t.id));

  const [{ data: archive }, { data: live }] = await Promise.all([
    borrowedBy.size
      ? sb
          .from("sccl_s6_players")
          .select(cols)
          .in("team_id", [...borrowedBy.keys()])
      : Promise.resolve({ data: [] as RosterPlayer[] }),
    sb.from("scout_players").select(cols).not("team_id", "is", null),
  ]);

  const out: RosterPlayer[] = [];

  for (const p of (archive ?? []) as RosterPlayer[]) {
    for (const teamId of borrowedBy.get(p.team_id ?? "") ?? []) {
      // `id` MUST stay the real player id — profile links are /scout/<id>, and
      // a synthetic key here 404s them. Callers that need a unique React key
      // for a player shown under two borrowing teams combine it with team_id.
      out.push({ ...p, team_id: teamId });
    }
  }

  for (const p of (live ?? []) as RosterPlayer[]) {
    if (p.team_id && ownIds.has(p.team_id)) out.push(p);
  }

  return out;
}
