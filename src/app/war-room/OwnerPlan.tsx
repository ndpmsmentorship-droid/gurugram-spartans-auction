"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normCategory } from "@/lib/scout/tier";
import { DEFAULT_RULES, inr } from "@/lib/auction/rules";
import { rateAll, buildPlan, STRATEGIES, DATA_LABEL, type PlanPlayer, type Rated, type StrategyKey } from "@/lib/auction/planner";
import { usePlanCalls, type Call } from "@/lib/auction/plan-calls";

export type PlanTeam = { id: string; name: string; purse_total: number; purse_max: number | null };
export type PoolPlayer = Omit<PlanPlayer, "cat"> & { auction_category: string | null };

const R = DEFAULT_RULES;
const RULES = { squadMin: R.squadMin, squadMax: R.squadMax, maxBid: R.maxBid, base: R.base, cap: R.cap };

export default function OwnerPlan(props: { seasonId: string; profileId: string; team: PlanTeam; players: PoolPlayer[] }) {
  const [players, setPlayers] = useState(props.players);
  const [team, setTeam] = useState(props.team);
  const [strategy, setStrategy] = useState<StrategyKey>("balanced");
  const [query, setQuery] = useState("");
  const { calls, setCall, going, rejected } = usePlanCalls(props.profileId);

  // Sales and top-ups land while the owner plans: refresh every 10 s.
  useEffect(() => {
    const sb = createClient();
    let alive = true;
    const pull = async () => {
      const [sold, t] = await Promise.all([
        sb.from("scout_players").select("id, team_id, sold_price").not("team_id", "is", null),
        sb.from("teams").select("purse_total, purse_max").eq("id", props.team.id).maybeSingle(),
      ]);
      if (!alive) return;
      if (sold.data) {
        const m = new Map((sold.data as unknown as { id: string; team_id: string; sold_price: number | null }[]).map((r) => [r.id, r]));
        setPlayers((ps) =>
          ps.map((p) => {
            const s = m.get(p.id);
            const team_id = s?.team_id ?? null, sold_price = s?.sold_price ?? null;
            return p.team_id === team_id && p.sold_price === sold_price ? p : { ...p, team_id, sold_price };
          }),
        );
      }
      const row = t.data as unknown as { purse_total: number; purse_max: number | null } | null;
      if (row) setTeam((x) => (x.purse_total === Number(row.purse_total) && x.purse_max === row.purse_max ? x : { ...x, purse_total: Number(row.purse_total), purse_max: row.purse_max }));
    };
    const id = setInterval(pull, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [props.team.id]);

  const rated = useMemo(() => rateAll(players.map((p) => ({ ...p, cat: normCategory(p.auction_category) ?? "B" })), RULES), [players]);
  const mine = useMemo(() => rated.filter((p) => p.team_id === team.id), [rated, team.id]);
  const spent = mine.reduce((a, p) => a + (p.sold_price ?? 0), 0);
  const purseLeft = team.purse_total - spent;
  const target = Math.max(R.squadMin, 12);
  const maxSafe = Math.max(0, purseLeft - Math.max(0, target - mine.length - 1) * R.base.B);
  const topUp = Math.max(0, (team.purse_max ?? team.purse_total) - team.purse_total);

  const goingKey = [...going].sort().join(","), rejectedKey = [...rejected].sort().join(",");
  const plans = useMemo(
    () => {
      const all = STRATEGIES.map((s) => ({ ...s, plan: buildPlan(s.key, { rated, mine, purseLeft, rules: RULES, going, rejected }) }));
      // "Balanced" promises the strongest XII, so it takes whichever squad scores highest.
      const top = all.reduce((a, b) => (b.plan.xii.score > a.plan.xii.score ? b : a));
      return all.map((s) => (s.key === "balanced" && top.plan.xii.score > s.plan.xii.score ? { ...s, plan: { ...top.plan, key: s.key } } : s));
    },
    [rated, mine, purseLeft, goingKey, rejectedKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const chosen = plans.find((p) => p.key === strategy)!.plan;

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return rated.filter((p) => !p.team_id && p.full_name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, rated]);
  const ruledOut = rated.filter((p) => rejected.has(p.id));
  const status = (p: Rated) => (p.team_id === team.id ? "bought" : going.has(p.id) ? "going" : "suggested");

  return (
    <div className="mx-auto w-full max-w-[520px] pb-24">
      {/* budget strip */}
      <div className="rounded-[12px] border border-line bg-surface px-4 py-3">
        <p className="text-[0.688rem] uppercase tracking-[0.14em] text-muted">{team.name}</p>
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
          <Stat k="To spend" v={inr(purseLeft)} />
          <Stat k="Most you can bid" v={inr(maxSafe)} />
          <Stat k="Places" v={String(Math.max(0, target - mine.length))} />
          <Stat k="XII" v={String(chosen.xii.score)} />
        </div>
        {topUp > 0 && <p className="mt-1 text-[0.688rem] text-muted">+ {inr(topUp)} top-up available in the auction</p>}
      </div>

      {/* strategies */}
      <section className="mt-5">
        <h1 className="font-display text-xl uppercase leading-tight">What kind of squad do you want?</h1>
        <p className="mt-1 text-sm text-muted">Each option is the best squad your purse can still buy, scored the same way: the playing XII&rsquo;s runs a match.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {plans.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStrategy(s.key)}
              className={`rounded-[12px] border p-3 text-left ${s.key === strategy ? "border-red ring-1 ring-red" : "border-line"}`}
            >
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="text-[0.688rem] text-muted">{s.blurb}</p>
              <p className="mt-2 num text-lg font-semibold leading-none">{s.plan.xii.score}</p>
              <p className="text-[0.688rem] text-muted">XII · {inr(s.plan.cost)} to buy</p>
            </button>
          ))}
        </div>
      </section>

      {/* field map of the playing XII */}
      <section className="mt-6">
        <p className="text-[0.688rem] uppercase tracking-[0.14em] text-muted">Playing XII · {STRATEGIES.find((s) => s.key === strategy)!.name}</p>
        <FieldMap twelve={chosen.xii.twelve} status={status} />
        <div className="mt-2 flex flex-wrap gap-3 text-[0.688rem] text-muted">
          <Legend c="bg-ink" l="In your squad" />
          <Legend c="bg-red" l="Going for him" />
          <Legend c="bg-up" l="Suggested buy" />
        </div>
        {!chosen.xii.keeper && <p className="mt-2 text-sm text-red">No wicket-keeper in this XII yet.</p>}
      </section>

      {/* to buy */}
      <section className="mt-6">
        <p className="text-[0.688rem] uppercase tracking-[0.14em] text-muted">To buy · {chosen.buys.length} players · {inr(chosen.cost)}</p>
        <ul className="mt-2 divide-y divide-line rounded-[12px] border border-line">
          {chosen.buys.map((p) => (
            <Row key={p.id} p={p} call={calls[p.id] ?? "hold"} setCall={(c) => setCall(p.id, c)} />
          ))}
          {!chosen.buys.length && <li className="p-3 text-sm text-muted">Nothing left to buy: your squad is full or the purse is spent.</li>}
        </ul>
      </section>

      {/* find a player */}
      <section className="mt-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a player to go for or rule out"
          className="w-full rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-red"
        />
        {found.length > 0 && (
          <ul className="mt-2 divide-y divide-line rounded-[12px] border border-line">
            {found.map((p) => (
              <Row key={p.id} p={p} call={calls[p.id] ?? "hold"} setCall={(c) => setCall(p.id, c)} />
            ))}
          </ul>
        )}
      </section>

      {ruledOut.length > 0 && (
        <section className="mt-6">
          <p className="text-[0.688rem] uppercase tracking-[0.14em] text-muted">Rejected · {ruledOut.length}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {ruledOut.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setCall(p.id, null)} className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:border-red">
                  {p.full_name} · undo
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-[0.688rem] leading-relaxed text-muted">
        Ratings come from Sarda/SCCL and Ball Library records; prices are estimates from each player&rsquo;s category base and rating. Players marked
        &ldquo;No data yet&rdquo; or &ldquo;Little data&rdquo; are rated at their category&rsquo;s median until their numbers come in. Your calls stay on this
        device and are private to your team.
      </p>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="num text-base font-semibold leading-tight">{v}</p>
      <p className="text-[0.625rem] leading-tight text-muted">{k}</p>
    </div>
  );
}

function Legend({ c, l }: { c: string; l: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${c}`} /> {l}
    </span>
  );
}

function Row({ p, call, setCall }: { p: Rated; call: Call; setCall: (c: Call) => void }) {
  return (
    <li className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{p.full_name}</p>
          <p className="text-[0.75rem] text-muted">
            {p.cat} · {p.primary_role ?? "—"}
            {p.data !== "ok" && <span className="ml-1.5 rounded-full bg-gold-fill px-1.5 py-0.5 text-[0.625rem] text-gold">{DATA_LABEL[p.data]}</span>}
          </p>
        </div>
        <p className="num shrink-0 text-sm">≈ {inr(p.price)}</p>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-[0.75rem]">
        {([["going", "Going for him"], ["hold", "Hold"], ["reject", "Reject"]] as const).map(([c, l]) => (
          <button
            key={c}
            type="button"
            onClick={() => setCall(c)}
            className={`rounded-full border px-2 py-1.5 ${
              call === c ? (c === "going" ? "border-red bg-red text-white" : c === "reject" ? "border-ink bg-ink text-white" : "border-ink") : "border-line text-muted"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </li>
  );
}

// The playing XII on a field: keeper behind the stumps, the lead bowler at the
// bowler's end, the rest round the ring; the twelfth sits below the map.
const SPOTS: [number, number][] = [
  [160, 92], [160, 232], [200, 78], [62, 128], [78, 206], [124, 270], [198, 270], [242, 206], [258, 128], [232, 58], [88, 58],
];
const short = (n: string) => {
  const w = n.trim().split(/\s+/);
  return w.length > 1 ? `${w[0][0]}. ${w[w.length - 1]}` : n;
};

function FieldMap({ twelve, status }: { twelve: Rated[]; status: (p: Rated) => "bought" | "going" | "suggested" }) {
  const keeper = twelve.find((p) => p.keeper);
  const bowler = twelve.filter((p) => p !== keeper && p.bowler).sort((a, b) => b.bowl - a.bowl)[0];
  const rest = twelve.filter((p) => p !== keeper && p !== bowler);
  const onField = [keeper ?? rest.shift(), bowler ?? rest.shift(), ...rest].filter(Boolean) as Rated[];
  const eleven = onField.slice(0, 11), twelfth = onField[11];
  const fill = { bought: "var(--color-ink)", going: "var(--color-red)", suggested: "var(--up)" } as const;
  return (
    <div className="mt-2">
      <svg viewBox="0 0 320 320" className="w-full" role="img" aria-label="Playing XII field map">
        <circle cx="160" cy="160" r="152" fill="color-mix(in srgb, var(--up) 7%, transparent)" stroke="var(--color-line)" />
        <circle cx="160" cy="160" r="88" fill="none" stroke="var(--color-line)" strokeDasharray="4 4" />
        <rect x="152" y="112" width="16" height="96" rx="2" fill="color-mix(in srgb, var(--gold, #c99a3c) 25%, transparent)" />
        {eleven.map((p, i) => (
          <g key={p.id}>
            <circle cx={SPOTS[i][0]} cy={SPOTS[i][1]} r="6" fill={fill[status(p)]} />
            <text x={SPOTS[i][0]} y={SPOTS[i][1] + 17} textAnchor="middle" fontSize="10" fill="currentColor">
              {short(p.full_name)}
            </text>
          </g>
        ))}
      </svg>
      {twelfth && (
        <p className="text-center text-[0.75rem] text-muted">
          12th: <span className="text-ink">{twelfth.full_name}</span>
        </p>
      )}
    </div>
  );
}
