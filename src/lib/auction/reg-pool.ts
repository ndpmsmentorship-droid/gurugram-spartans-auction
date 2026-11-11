import "server-only";

// The Planner and War Room show only players in the Season 2 pool: a
// scout_players row counts when a live registration (paid, not rejected)
// matches it — by its reg:<id> source, its CricHeroes id or its name, the same
// matching "Add approved players to the pool" uses. Players already sold to a
// team always stay, so squads and purses never lose a row.
const SEASON = "SDLL-S2";
const OUT = new Set(["rejected", "awaiting_payment"]);

const chId = (link: string | null | undefined) =>
  link?.match(/player-profile\/(\d+)/)?.[1] ?? link?.match(/\/(\d{4,})(?:\/|$)/)?.[1] ?? null;
const nameKey = (n: string | null | undefined) => (n ?? "").toLowerCase().replace(/\s+/g, " ").trim();

type Scout = { id: string; full_name: string | null; cricheroes_link?: string | null; source_id?: string | null; team_id?: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function inRegistrationPool<T extends Scout>(sb: { from: (t: string) => any }, players: T[]): Promise<T[]> {
  const { data: regs } = await sb
    .from("registrations")
    .select("id, phone, full_name, status, cricheroes_link, master_id")
    .eq("season", SEASON);
  const live = ((regs ?? []) as { id: string; phone: string | null; full_name: string | null; status: string; cricheroes_link: string | null; master_id: string | null }[])
    .filter((r) => !OUT.has(r.status));
  const masterIds = live.map((r) => r.master_id).filter(Boolean) as string[];
  const { data: masters } = masterIds.length
    ? await sb.from("player_master").select("id, full_name, cricheroes_link").in("id", masterIds)
    : { data: [] };
  const mById = new Map(((masters ?? []) as { id: string; full_name: string | null; cricheroes_link: string | null }[]).map((m) => [m.id, m]));

  const regIds = new Set(live.map((r) => `reg:${r.id}`));
  const chIds = new Set<string>();
  // name -> the CricHeroes ids registered under it ("" = a registration with no readable id)
  const names = new Map<string, Set<string>>();
  for (const r of live) {
    const m = r.master_id ? mById.get(r.master_id) : undefined;
    const ids = [chId(r.cricheroes_link), chId(m?.cricheroes_link)].filter(Boolean) as string[];
    for (const c of ids) chIds.add(c);
    for (const n of [nameKey(r.full_name), nameKey(m?.full_name)]) {
      if (!n) continue;
      const set = names.get(n) ?? new Set<string>();
      if (ids.length) ids.forEach((c) => set.add(c));
      else set.add("");
      names.set(n, set);
    }
  }
  // Same name is not the same person (12 Nov: a USCL-pool "Nitin Yadav", CricHeroes 487209, rode in
  // on registrant Nitin Yadav, 944570): when both sides carry a CricHeroes id, the ids must agree.
  const sameName = (p: Scout) => {
    const set = names.get(nameKey(p.full_name));
    if (!set) return false;
    const c = chId(p.cricheroes_link);
    return !c || set.has("") || set.has(c);
  };
  return players.filter(
    (p) =>
      !!p.team_id ||
      (!!p.source_id && regIds.has(p.source_id)) ||
      (() => {
        const c = chId(p.cricheroes_link);
        return !!c && chIds.has(c);
      })() ||
      sameName(p),
  );
}
