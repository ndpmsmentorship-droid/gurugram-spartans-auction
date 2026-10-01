// USCL Right to Match (Owners & Retention Rules deck, p.1):
//   - each existing franchise (the six below) holds one RTM for the season
//   - on an RTM call, the franchise that won the bid may revise it once; the
//     RTM franchise then matches (player moves to them) or declines
//   - at most two successful RTMs against any single franchise
// A matched RTM is stored on the player: acquired = 'rtm', team_id = the RTM
// franchise, rtm_against = the team that had won him (supabase/uscl_rtm.sql).
export const RTM_FRANCHISES = [
  "Bengal Tigers",
  "Chennai Thalaiva",
  "Delhi Devil",
  "Lucknow Lagers",
  "Punjab Royals",
  "Royal Challengers Gurgaon",
];
export const RTM_MAX_AGAINST = 2;

type T = { id: string; name: string };
type P = { id: string; full_name: string; team_id: string | null; acquired: string | null; rtm_against?: string | null };

export type RtmState = {
  /** team id -> the player it used its RTM on (null = still holds it); only the six franchises */
  holders: Map<string, P | null>;
  /** team id -> successful RTMs taken against it */
  against: Map<string, number>;
};

export function rtmState(teams: T[], players: P[]): RtmState {
  const holders = new Map<string, P | null>();
  for (const t of teams) if (RTM_FRANCHISES.includes(t.name)) holders.set(t.id, null);
  const against = new Map<string, number>();
  for (const p of players) {
    if (p.acquired !== "rtm" || !p.team_id) continue;
    if (holders.has(p.team_id)) holders.set(p.team_id, p);
    if (p.rtm_against) against.set(p.rtm_against, (against.get(p.rtm_against) ?? 0) + 1);
  }
  return { holders, against };
}

/** Franchises that could still RTM a player currently with `winnerId`. */
export function rtmThreats(s: RtmState, winnerId: string): string[] {
  if ((s.against.get(winnerId) ?? 0) >= RTM_MAX_AGAINST) return [];
  return [...s.holders].filter(([id, used]) => !used && id !== winnerId).map(([id]) => id);
}
