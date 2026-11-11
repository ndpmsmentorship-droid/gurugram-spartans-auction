"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normCategory, SPI_PENDING } from "@/lib/scout/tier";
import { DEFAULT_RULES, inr } from "@/lib/auction/rules";
import { rateAll, buildPlan, STRATEGIES, DATA_LABEL, type PlanPlayer, type Rated, type StrategyKey } from "@/lib/auction/planner";
import { usePlanCalls, type Call } from "@/lib/auction/plan-calls";
import { catLabel } from "@/lib/scout/tier";
import { PlayerPhoto } from "@/app/register/PlayerCard";
import TeamCrest from "@/app/TeamCrest";
import { Tile } from "./WarRoom";

export type PlanTeam = { id: string; name: string; purse_total: number; purse_max: number | null; logo_url?: string | null };
export type PoolPlayer = Omit<PlanPlayer, "cat"> & { auction_category: string | null; photo_url?: string | null };

const R = DEFAULT_RULES;
const RULES = { squadMin: R.squadMin, squadMax: R.squadMax, maxBid: R.maxBid, base: R.base, cap: R.cap };

export default function OwnerPlan(props: { seasonId: string; profileId: string; team: PlanTeam; players: PoolPlayer[]; leagueName?: string }) {
  const [players, setPlayers] = useState(props.players);
  const [synced, setSynced] = useState<number | null>(null);
  const [team, setTeam] = useState(props.team);
  const [strategy, setStrategy] = useState<StrategyKey>("balanced");
  const [query, setQuery] = useState("");
  const { calls, setCall, going, held, rejected } = usePlanCalls(props.profileId);

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
      setSynced(Date.now());
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
  const pending = useMemo(() => new Set(players.filter((p) => !normCategory(p.auction_category)).map((p) => p.id)), [players]);
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
  const onHold = rated.filter((p) => held.has(p.id));
  const status = (p: Rated) => (p.team_id === team.id ? "bought" : going.has(p.id) ? "going" : "suggested");

  const photo = useMemo(() => new Map(players.map((p) => [p.id, p.photo_url ?? null])), [players]);
  const cats = useMemo(() => {
    const c: Record<string, number> = { "A+": 0, A: 0, B: 0, Special: 0 };
    for (const p of mine) c[p.cat] = (c[p.cat] ?? 0) + 1;
    return c;
  }, [mine]);
  const card = "rounded-[16px] border border-line bg-surface p-4 shadow-[var(--elev-sm)]";
  const row = (p: Rated) => <Row key={p.id} p={p} photo={photo.get(p.id) ?? null} pend={pending.has(p.id)} call={calls[p.id]} setCall={(c) => setCall(p.id, c)} />;

  // Same frame as the War Room (header, money tiles, cards, player rows), so the
  // planner is auction-night practice: owners learn where everything sits.
  return (
    <div className="mx-auto w-full max-w-[1280px] pb-24">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">
            Plan · <span className="sm:hidden">SLL Season 2</span>
            <span className="hidden sm:inline">{props.leagueName ?? "SLL Season 2"}</span>
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-3xl sm:text-4xl">
            {team.logo_url && <TeamCrest name={team.name} logoUrl={team.logo_url} size={52} />}
            {team.name}
          </h1>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-up" /> live{synced ? ` · ${new Date(synced).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
        </span>
      </div>

      {/* tiles: the War Room's own row */}
      <section className="mt-4 grid gap-2 lg:grid-cols-[2fr_5fr]">
        <div className="grid grid-cols-2 gap-2">
          <Tile k="Purse left" v={inr(purseLeft)} sub={`of ${inr(team.purse_total)}${topUp ? ` · +${inr(topUp)} top-ups available` : ""}`} strong />
          <Tile k="Max safe bid" v={inr(maxSafe)} sub={`keeps ${Math.max(0, target - mine.length - 1)} slots at ${inr(R.base.B)}`} strong />
        </div>
        <div className="grid grid-cols-5 gap-2">
          <Tile k="Squad" v={`${mine.length}`} sub={`${R.squadMin}–${R.squadMax}`} compact />
          {(["A+", "A", "B", "Special"] as const).map((c) => (
            <Tile key={c} k={catLabel(c)} v={`${cats[c] ?? 0}`} sub={`max ${R.cap[c]}`} warn={c !== "B" && (cats[c] ?? 0) >= R.cap[c]} compact />
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* strategies + the buy list */}
        <section className={card}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="eyebrow">What kind of squad?</p>
            <p className="text-xs text-muted">scored as the XII&rsquo;s runs a match</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {plans.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStrategy(s.key)}
                className={`rounded-[12px] border p-3 text-left transition ${s.key === strategy ? "border-red bg-[color-mix(in_srgb,var(--red)_6%,transparent)]" : "border-line hover:border-red/40 hover:bg-wash"}`}
              >
                <p className="label-mono">{s.name}</p>
                <p className="mt-1.5 font-display text-2xl leading-none tabular-nums">{s.plan.xii.score}</p>
                <p className="mt-1 text-[0.68rem] leading-snug text-muted">XII · {inr(s.plan.cost)} to buy</p>
                <p className="mt-1 text-[0.68rem] leading-snug text-muted">{s.blurb}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-baseline justify-between">
            <p className="eyebrow">To buy · {chosen.buys.length}</p>
            <p className="tabular-nums text-sm text-muted">{inr(chosen.cost)}</p>
          </div>
          <ul className="mt-3 grid gap-2">
            {chosen.buys.map(row)}
            {!chosen.buys.length && <li className="text-sm text-muted">Nothing left to buy: your squad is full or the purse is spent.</li>}
          </ul>
        </section>

        {/* the playing XII */}
        <section className={`${card} self-start`}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="eyebrow">Playing XII · {STRATEGIES.find((s) => s.key === strategy)!.name}</p>
            <span className="font-display text-2xl leading-none tabular-nums">{chosen.xii.score}</span>
          </div>
          <FieldMap twelve={chosen.xii.twelve} status={status} />
          <div className="mt-2 flex flex-wrap gap-3 text-[0.72rem] text-muted">
            <Legend c="bg-ink" l="In your squad" />
            <Legend c="bg-red" l="Going for him" />
            <Legend c="bg-up" l="Suggested buy" />
          </div>
          {!chosen.xii.keeper && <p className="mt-2 text-sm text-red">No wicket-keeper in this XII yet.</p>}
        </section>
      </div>

      {/* find a player: the War Room pool's search box */}
      <section className={`mt-5 ${card}`}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow mr-2">Pool</p>
          <div className="relative w-full sm:w-[26rem]">
            <input className="input !py-2 !pr-8 text-sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a player to go for or rule out" />
            {query && (
              <button type="button" aria-label="Clear" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-muted hover:text-ink">✕</button>
            )}
          </div>
        </div>
        {found.length > 0 && <ul className="mt-3 grid gap-2 sm:grid-cols-2">{found.map(row)}</ul>}
      </section>

      {onHold.length > 0 && (
        <section className={`mt-5 ${card}`}>
          <p className="eyebrow">On hold · {onHold.length}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{onHold.map(row)}</ul>
        </section>
      )}

      {ruledOut.length > 0 && (
        <section className={`mt-5 ${card}`}>
          <p className="eyebrow">Rejected · {ruledOut.length}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {ruledOut.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setCall(p.id, null)} className="pill !px-3 !py-1.5">
                  {p.full_name} · undo
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-[0.72rem] leading-relaxed text-muted">
        Ratings come from Sarda/SCCL and Ball Library records; prices are estimates from each player&rsquo;s category base and rating. Categories show &ldquo;SPI pending&rdquo; until the SPI grading is published after registration closes; until then those players are priced at the B base. Players marked
        &ldquo;No data yet&rdquo; or &ldquo;Little data&rdquo; are rated at their category&rsquo;s median until their numbers come in. Your calls stay on this
        device, are private to your team, and show on the War Room&rsquo;s live card on auction night.
      </p>
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

// A War Room player card with the three calls under it. Tapping the active call again clears it.
function Row({ p, photo, pend, call, setCall }: { p: Rated; photo: string | null; pend: boolean; call?: Call; setCall: (c: Call | null) => void }) {
  return (
    <li className={`rounded-[10px] border p-2 ${call === "going" ? "border-red bg-[color-mix(in_srgb,var(--red)_7%,transparent)]" : "border-line"}`}>
      <div className="flex items-center gap-3">
        <PlayerPhoto src={photo} name={p.full_name} className="h-10 w-10 shrink-0 rounded-full" sizes="40px" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{p.full_name}</p>
          <p className="truncate text-[0.72rem] text-muted">
            {[pend ? SPI_PENDING : catLabel(p.cat), p.primary_role, `≈ ${inr(p.price)}`].filter(Boolean).join(" · ")}
            {p.data !== "ok" && <span className="ml-1.5 rounded-full bg-gold-fill px-1.5 py-0.5 text-[0.625rem] text-gold">{DATA_LABEL[p.data]}</span>}
          </p>
        </div>
        <span className="shrink-0 font-display text-lg">{p.overall_index != null ? Math.round(p.overall_index) : "—"}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {([["going", "Going for him"], ["hold", "Hold"], ["reject", "Reject"]] as const).map(([c, l]) => (
          <button key={c} type="button" className="pill !px-3 !py-1" data-active={call === c} aria-pressed={call === c} onClick={() => setCall(call === c ? null : c)}>
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
