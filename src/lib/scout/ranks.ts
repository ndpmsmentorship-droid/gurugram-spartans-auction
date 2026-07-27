// Turn stored index columns into ordinal ranks (1 = best). Computed on read so
// ranks always reflect the current pool. Null indices rank last (no data).

export type RankedPlayer<T> = T & {
  overall_rank: number;
  bat_rank: number;
  bowl_rank: number;
  field_rank: number;
  keep_rank: number | null;
};

type Indexable = {
  id: string;
  overall_index: number | null;
  bat_index: number | null;
  bowl_index: number | null;
  field_index: number | null;
  keep_index: number | null;
};

function rankBy<T extends Indexable>(
  players: T[],
  key: "overall_index" | "bat_index" | "bowl_index" | "field_index" | "keep_index"
): Map<string, number | null> {
  const withVal = players
    .filter((p) => p[key] != null)
    .sort((a, b) => (b[key] as number) - (a[key] as number));
  const map = new Map<string, number | null>();
  withVal.forEach((p, i) => map.set(p.id, i + 1));
  for (const p of players) if (!map.has(p.id)) map.set(p.id, null);
  return map;
}

export function rankPlayers<T extends Indexable>(players: T[]): RankedPlayer<T>[] {
  const overall = rankBy(players, "overall_index");
  const bat = rankBy(players, "bat_index");
  const bowl = rankBy(players, "bowl_index");
  const field = rankBy(players, "field_index");
  const keep = rankBy(players, "keep_index");

  return players.map((p) => ({
    ...p,
    overall_rank: overall.get(p.id) ?? 9999,
    bat_rank: bat.get(p.id) ?? 9999,
    bowl_rank: bowl.get(p.id) ?? 9999,
    field_rank: field.get(p.id) ?? 9999,
    keep_rank: keep.get(p.id) ?? null,
  }));
}
