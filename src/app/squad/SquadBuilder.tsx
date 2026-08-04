"use client";

import { useEffect, useState, type ReactNode } from "react";
import { isGradeA, isU35, tierStyle } from "@/lib/scout/tier";

const WARM = "linear-gradient(135deg, #FF8A3D 0%, #E0453A 100%)";
const WARM_INK = "#D2451F";
const GOLD = "#E3A81B";
const BLUE = "#2F6FED"; // marks actual auction (mock) buys, vs the retained core
const STORE_KEY = "spartans-budget-v1";

export type SquadPursePlayer = {
  id: string;
  name: string;
  cost: number;
  order: number; // default batting-order slot
  role: string;
  isCaptain: boolean;
  isKeeper: boolean;
  isGold?: boolean;
  category: string; // SCCL auction tier (U35A / 35+A / U35B / 35+B / Legend)
};

// A player bought at the auction — fills the squad/bench positions the retained
// core doesn't occupy, ordered by their suggested batting order.
export type Signing = {
  id: string;
  name: string;
  role: string | null;
  isKeeper: boolean;
  order: number | null;
  price: number | null;
  category: string | null; // playing-style category (Top Order, Off Break…)
  tier: string | null; // SCCL auction tier (U35A / 35+A / U35B / 35+B)
};

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

// Green→amber→red heat for a normalized value t (0 = cheapest/green, 1 =
// dearest/red). Used to colour the squad price pills by spend.
function heatColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  const stops: [number, number, number][] = [
    [46, 139, 87], // green  — lowest
    [224, 160, 32], // amber — middle
    [224, 69, 58], // red    — highest
  ];
  const [a, b, f] = c < 0.5 ? [stops[0], stops[1], c * 2] : [stops[1], stops[2], (c - 0.5) * 2];
  const mix = a.map((v, i) => Math.round(v + (b[i] - v) * f));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

// One SCCL composition cap (e.g. A-category 4/6). Pips are split by source:
// locked-in retained core in red, mock buys in yellow, so you can see how much
// headroom your buys are eating. The count turns red once the cap is breached.
const PIP_RETAINED = "#E0453A"; // red — retained core
const PIP_MOCK = "#E9C230"; // yellow — mock buys
function CapMeter({
  label,
  hint,
  usedRetained,
  usedMock,
  max,
  over,
}: {
  label: string;
  hint: string;
  usedRetained: number;
  usedMock: number;
  max: number;
  over: boolean;
}) {
  const used = usedRetained + usedMock;
  const total = Math.max(max, used);
  return (
    <div className="flex-1 rounded-[12px] bg-wash px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">{label}</span>
        <span
          className="font-display text-sm font-bold tabular-nums"
          style={{ color: over ? "var(--down)" : "var(--foreground)" }}
        >
          {used}/{max}
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: total }).map((_, i) => {
          const filled = i < used;
          const isMock = i >= usedRetained && i < used; // mock buys sit after retained
          return (
            <span
              key={i}
              className="h-1.5 flex-1 rounded-full"
              style={{
                minWidth: 6,
                background: filled ? (isMock ? PIP_MOCK : PIP_RETAINED) : "var(--surface)",
                boxShadow: filled
                  ? over && i >= max
                    ? "inset 0 0 0 1.5px var(--down)"
                    : "none"
                  : "inset 0 0 0 1px var(--border)",
              }}
            />
          );
        })}
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[0.66rem]" style={{ color: over ? "var(--down)" : "var(--muted)" }}>
        <span>{over ? `Over the cap — ${hint}` : hint}</span>
        {usedMock > 0 ? (
          <span className="inline-flex items-center gap-1 text-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: PIP_MOCK }} />
            mock buys
          </span>
        ) : null}
      </p>
    </div>
  );
}

// tinted pill for the SCCL category (A tiers warm, Legend gold, B/other neutral)
const catStyle = (c: string): { background: string; color: string } =>
  /legend/i.test(c)
    ? { background: "color-mix(in srgb, #E3A81B 18%, transparent)", color: "#B4820F" }
    : /a$/i.test(c)
      ? { background: "color-mix(in srgb, #E0453A 14%, transparent)", color: "#C2371D" }
      : { background: "var(--wash)", color: "var(--muted)" };

export default function SquadBuilder({
  players,
  signings = [],
  defaultBudget,
  squadSize,
  maxSquad,
  maxA,
  maxU35,
  retainedCount,
  marquee,
  children,
}: {
  players: SquadPursePlayer[];
  signings?: Signing[];
  defaultBudget: number;
  squadSize: number; // positions shown in the full list (rest are bench cards)
  maxSquad: number;
  maxA: number; // SCCL cap: A-category players in the Playing 13
  maxU35: number; // SCCL cap: players aged 30–35 (U35) per squad
  retainedCount: number;
  marquee?: ReactNode; // marquee "must buy" targets, rendered under the list
  children?: ReactNode; // player cards, rendered in the middle section
}) {
  // cost defaults for retained AND mock buys (signings), both editable + in purse
  const defaultCosts = Object.fromEntries([
    ...players.map((p) => [p.id, p.cost] as const),
    ...signings.map((s) => [s.id, s.price ?? 0] as const),
  ]);
  // batting-order defaults for retained AND mock buys (signings), both editable
  const defaultOrders = Object.fromEntries([
    ...players.map((p) => [p.id, p.order] as const),
    ...signings.map((s, i) => [s.id, s.order ?? 100 + i] as const),
  ]);
  const [budget, setBudget] = useState(defaultBudget);
  const [costs, setCosts] = useState<Record<string, number>>(defaultCosts);
  const [orders, setOrders] = useState<Record<string, number>>(defaultOrders);

  // Load any saved overrides *after* mount so the SSR/first-client markup stays
  // deterministic (reading localStorage during render would hydration-mismatch).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        budget?: number;
        costs?: Record<string, number>;
        orders?: Record<string, number>;
      };
      if (typeof saved.budget === "number") setBudget(saved.budget);
      if (saved.costs) setCosts((c) => ({ ...c, ...saved.costs }));
      if (saved.orders) setOrders((o) => ({ ...o, ...saved.orders }));
    } catch {
      /* ignore bad storage */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const persist = (next: {
    budget: number;
    costs: Record<string, number>;
    orders: Record<string, number>;
  }) => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const setCost = (id: string, value: number) => {
    const next = { ...costs, [id]: value };
    setCosts(next);
    persist({ budget, costs: next, orders });
  };
  const setOrder = (id: string, value: number) => {
    const next = { ...orders, [id]: value };
    setOrders(next);
    persist({ budget, costs, orders: next });
  };
  const changeBudget = (value: number) => {
    setBudget(value);
    persist({ budget: value, costs, orders });
  };
  const reset = () => {
    setBudget(defaultBudget);
    setCosts(defaultCosts);
    setOrders(defaultOrders);
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {
      /* ignore */
    }
  };

  const spent =
    players.reduce((s, p) => s + (costs[p.id] ?? 0), 0) +
    signings.reduce((s, x) => s + (costs[x.id] ?? 0), 0);
  const remaining = budget - spent;

  // price heat scale: red = dearest, green = cheapest, across the whole squad
  const priceValues = [
    ...players.map((p) => costs[p.id] ?? 0),
    ...signings.map((s) => costs[s.id] ?? s.price ?? 0),
  ].filter((v) => v > 0);
  const priceMin = priceValues.length ? Math.min(...priceValues) : 0;
  const priceMax = priceValues.length ? Math.max(...priceValues) : 0;
  const priceStyle = (v: number): { background: string; color: string } => {
    const t = priceMax > priceMin ? (v - priceMin) / (priceMax - priceMin) : 0;
    const c = heatColor(t);
    return { background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c };
  };

  // SCCL composition caps: ≤ maxA 'A'-category (Playing 13) and ≤ maxU35 players
  // aged 30–35 (U35), counted across the whole built squad (retained + buys).
  const retainedIdSet = new Set(players.map((p) => p.id));
  const retainedTiers = players.map((p) => p.category);
  const mockTiers = signings.filter((s) => !retainedIdSet.has(s.id)).map((s) => s.tier);
  const aRetained = retainedTiers.filter(isGradeA).length;
  const aMock = mockTiers.filter(isGradeA).length;
  const u35Retained = retainedTiers.filter(isU35).length;
  const u35Mock = mockTiers.filter(isU35).length;
  const aOver = aRetained + aMock > maxA;
  const u35Over = u35Retained + u35Mock > maxU35;
  const openSlots = Math.max(0, maxSquad - retainedCount);
  const perSlot = openSlots > 0 ? remaining / openSlots : 0;
  const pct = budget > 0 ? Math.min(100, Math.max(0, (spent / budget) * 100)) : 0;
  const over = remaining < 0;

  // place each retained player at their (editable) batting-order position
  const byPosition = new Map<number, SquadPursePlayer>();
  for (const p of players) byPosition.set(orders[p.id] ?? p.order, p);

  // fill the remaining slots (1..maxSquad) with auction signings, in order of
  // their suggested batting order — so the squad + bench reflect who's bought.
  const retainedIds = new Set(players.map((p) => p.id));
  const signingByPosition = new Map<number, Signing>();
  const signingOrder = (s: Signing) => orders[s.id] ?? s.order ?? 1e9;
  const sortedSignings = [...signings]
    .filter((s) => !retainedIds.has(s.id))
    .sort((a, b) => signingOrder(a) - signingOrder(b));
  let si = 0;
  for (let pos = 1; pos <= maxSquad && si < sortedSignings.length; pos++) {
    if (byPosition.has(pos)) continue;
    signingByPosition.set(pos, sortedSignings[si++]);
  }

  const listPositions = Array.from({ length: squadSize }, (_, i) => i + 1);
  const benchPositions = Array.from(
    { length: Math.max(0, maxSquad - squadSize) },
    (_, i) => squadSize + i + 1
  );

  // players sorted by current batting order, for the data-entry form
  const orderedPlayers = [...players].sort(
    (a, b) => (orders[a.id] ?? a.order) - (orders[b.id] ?? b.order)
  );

  return (
    <div className="space-y-6">
      {/* ============ TOP: refined summary + probable order ============ */}
      <div className="card overflow-hidden p-0">
        {/* purse banner */}
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="eyebrow" style={{ color: WARM_INK }}>
              Purse used
            </p>
            <p className="mt-1 font-display text-2xl font-bold leading-none">
              {inr(spent)}{" "}
              <span className="text-base font-semibold text-muted">/ {inr(budget)}</span>
            </p>
            <p className="mt-1 text-[0.72rem] text-muted">
              {players.length} retained
              {signings.length > 0 ? ` + ${signings.length} mock ${signings.length === 1 ? "buy" : "buys"}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p
              className="font-display text-2xl font-bold leading-none"
              style={{ color: over ? "var(--down)" : WARM_INK }}
            >
              {over ? "-" : ""}
              {inr(Math.abs(remaining))}
            </p>
            <p className="mt-1 text-[0.72rem] text-muted">{over ? "over budget" : "left in purse"}</p>
          </div>
          <div className="w-full">
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ background: "var(--wash)", boxShadow: "inset 0 0 0 1px var(--border)" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: over ? "var(--down)" : WARM }}
              />
            </div>
            {openSlots > 0 ? (
              <p className="mt-2 text-[0.72rem] text-muted">
                {over ? "Trim costs — you're over the cap. " : `${inr(perSlot)} per slot `}
                across {openSlots} open slots (to a {maxSquad}-player squad).
              </p>
            ) : null}
          </div>
        </div>

        {/* SCCL composition caps */}
        <div className="flex flex-wrap gap-2 border-b border-border px-3 py-3 sm:px-5">
          <CapMeter
            label="A category"
            hint={`max ${maxA} in the Playing 13`}
            usedRetained={aRetained}
            usedMock={aMock}
            max={maxA}
            over={aOver}
          />
          <CapMeter
            label="U35 (30–35)"
            hint={`buy up to ${maxU35} in the squad · 3 play per match`}
            usedRetained={u35Retained}
            usedMock={u35Mock}
            max={maxU35}
            over={u35Over}
          />
        </div>

        {/* probable order list */}
        <div className="px-3 py-3">
          <p className="eyebrow px-2 pb-2">Probable batting order</p>
          <ol className="flex flex-col">
            {listPositions.map((pos) => {
              const player = byPosition.get(pos) ?? null;
              const signing = signingByPosition.get(pos) ?? null;
              const top = pos <= 6;
              return (
                <li
                  key={pos}
                  className={`flex items-center gap-3 rounded-[12px] px-2 py-2 ${
                    player || signing ? "" : "opacity-70"
                  } ${pos % 2 === 0 ? "bg-wash/60" : ""}`}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[0.85rem] font-bold tabular-nums"
                    style={
                      (player || signing) && top
                        ? { background: WARM, color: "#fff" }
                        : {
                            background: "var(--wash)",
                            color: "var(--muted)",
                            boxShadow: "inset 0 0 0 1px var(--border)",
                          }
                    }
                  >
                    {pos}
                  </span>

                  {player ? (
                    <>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                          <span className="font-semibold text-[0.95rem]">{player.name}</span>
                          {player.isCaptain ? (
                            <span className="badge shrink-0" style={{ background: GOLD, color: "#1d1d1f" }}>
                              C
                            </span>
                          ) : null}
                          {player.isKeeper ? (
                            <span
                              className="badge shrink-0"
                              style={{ background: "var(--wash)", color: "var(--muted)" }}
                            >
                              WK
                            </span>
                          ) : null}
                          <span className="badge shrink-0" style={catStyle(player.category)}>
                            {player.category}
                          </span>
                        </div>
                        <span className="mt-0.5 text-[0.82rem] text-muted">{player.role}</span>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold tabular-nums"
                        style={priceStyle(costs[player.id] ?? 0)}
                      >
                        {inr(costs[player.id] ?? 0)}
                      </span>
                    </>
                  ) : signing ? (
                    <>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                          <span className="text-[0.95rem] font-bold" style={{ color: BLUE }}>
                            {signing.name}
                          </span>
                          <span
                            className="badge shrink-0 font-semibold"
                            style={{ background: `color-mix(in srgb, ${BLUE} 16%, transparent)`, color: BLUE }}
                          >
                            bought
                          </span>
                          {signing.isKeeper ? (
                            <span
                              className="badge shrink-0"
                              style={{ background: "var(--wash)", color: "var(--muted)" }}
                            >
                              WK
                            </span>
                          ) : null}
                          {(() => {
                            const ts = tierStyle(signing.tier);
                            return ts ? (
                              <span
                                className="badge shrink-0"
                                style={{ background: ts.bg, color: ts.fg }}
                                title="Organizers' auction category"
                              >
                                {signing.tier}
                              </span>
                            ) : null;
                          })()}
                          {signing.category ? (
                            <span className="badge shrink-0" style={catStyle(signing.category)}>
                              {signing.category}
                            </span>
                          ) : null}
                        </div>
                        <span className="mt-0.5 text-[0.82rem] text-muted">
                          {signing.role ?? "—"}
                        </span>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2.5 py-1 text-[0.72rem] font-bold tabular-nums"
                        style={priceStyle(costs[signing.id] ?? signing.price ?? 0)}
                      >
                        {inr(costs[signing.id] ?? signing.price ?? 0)}
                      </span>
                    </>
                  ) : (
                    <span className="flex-1 text-[0.85rem] italic text-muted">
                      Open — target at auction
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          {/* bench / friends — buy but won't make the squad */}
          {benchPositions.length > 0 ? (
            <div className="mt-3 border-t border-border px-2 pt-3">
              <p className="eyebrow pb-2">
                Bench · friends{" "}
                <span className="font-normal normal-case tracking-normal text-muted">
                  — auction buys beyond the top {squadSize}
                </span>
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {benchPositions.map((pos) => {
                  const player = byPosition.get(pos) ?? null;
                  const signing = signingByPosition.get(pos) ?? null;
                  const name = player?.name ?? signing?.name ?? null;
                  const role = player?.role ?? signing?.role ?? null;
                  return (
                    <div
                      key={pos}
                      className="flex flex-col gap-1 rounded-[12px] bg-wash px-3 py-2.5"
                    >
                      <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-muted">
                        Slot {pos}
                      </span>
                      {name ? (
                        <>
                          <span className="truncate text-sm font-semibold">{name}</span>
                          <span className="truncate text-[0.68rem] text-muted">{role ?? "—"}</span>
                        </>
                      ) : (
                        <span className="text-[0.8rem] italic text-muted">Open</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ============ marquee "must buy" targets ============ */}
      {marquee}

      {/* ============ MIDDLE: player cards ============ */}
      {children}

      {/* ============ BOTTOM: data entry form ============ */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="eyebrow" style={{ color: WARM_INK }}>
              Data entry — order &amp; retention
            </p>
            <span
              className="badge"
              style={{ background: "color-mix(in srgb, #E0453A 14%, transparent)", color: WARM_INK }}
            >
              editable
            </span>
          </div>
          <button onClick={reset} className="text-xs text-muted hover:underline">
            Reset
          </button>
        </div>

        {/* total purse cap */}
        <label className="mt-3 flex items-center justify-between gap-2 rounded-[12px] bg-wash px-3 py-2">
          <span className="text-sm font-medium">Total purse (cap)</span>
          <span className="flex items-center gap-1">
            <span className="text-muted">₹</span>
            <input
              type="number"
              inputMode="numeric"
              value={budget}
              onChange={(e) => changeBudget(Number(e.target.value) || 0)}
              className="w-28 rounded-md bg-surface px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2"
              style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
            />
          </span>
        </label>

        {/* per-player order + retention */}
        <div className="mt-3">
          <div className="flex items-center gap-3 px-1 pb-1.5 text-[0.62rem] font-medium uppercase tracking-wide text-muted">
            <span className="flex-1">Player</span>
            <span className="w-16 shrink-0 text-center">Order</span>
            <span className="w-24 shrink-0 text-right">Retention</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {orderedPlayers.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-[12px] bg-wash px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label={`Batting order for ${p.name}`}
                  value={orders[p.id] ?? p.order}
                  onChange={(e) => setOrder(p.id, Number(e.target.value) || 0)}
                  className="w-16 shrink-0 rounded-md bg-surface px-2 py-1 text-center text-sm tabular-nums outline-none focus:ring-2"
                  style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
                />
                <span className="flex w-24 shrink-0 items-center justify-end gap-1">
                  <span className="text-muted">₹</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label={`Retention amount for ${p.name}`}
                    value={costs[p.id] ?? 0}
                    onChange={(e) => setCost(p.id, Number(e.target.value) || 0)}
                    className="w-full rounded-md bg-surface px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2"
                    style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* mock buys — editable batting order */}
        {sortedSignings.length > 0 ? (
          <div className="mt-4 border-t border-border pt-3">
            <p className="eyebrow pb-1.5" style={{ color: WARM_INK }}>
              Mock buys — order &amp; price
            </p>
            <div className="flex items-center gap-3 px-1 pb-1.5 text-[0.62rem] font-medium uppercase tracking-wide text-muted">
              <span className="flex-1">Player</span>
              <span className="w-14 shrink-0 text-center">Order</span>
              <span className="w-24 shrink-0 text-right">Price</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {sortedSignings.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-[12px] bg-wash px-3 py-2">
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="min-w-0 truncate text-sm font-medium">{s.name}</span>
                    {s.isKeeper ? (
                      <span
                        className="badge shrink-0"
                        style={{ background: "var(--wash)", color: "var(--muted)" }}
                      >
                        WK
                      </span>
                    ) : null}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label={`Batting order for ${s.name}`}
                    value={orders[s.id] ?? s.order ?? ""}
                    onChange={(e) => setOrder(s.id, Number(e.target.value) || 0)}
                    className="w-14 shrink-0 rounded-md bg-surface px-2 py-1 text-center text-sm tabular-nums outline-none focus:ring-2"
                    style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
                  />
                  <span className="flex w-24 shrink-0 items-center justify-end gap-1">
                    <span className="text-muted">₹</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      aria-label={`Mock buy price for ${s.name}`}
                      value={costs[s.id] ?? s.price ?? 0}
                      onChange={(e) => setCost(s.id, Number(e.target.value) || 0)}
                      className="w-full rounded-md bg-surface px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2"
                      style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <p className="mt-3 text-[0.68rem] text-muted">
          Changing the order re-ranks the probable list above (retained core sits at fixed slots; mock
          buys fill the rest by the order you set). Edits save in this browser; change the defaults for
          everyone in <code>retained.ts</code>.
        </p>
      </div>
    </div>
  );
}
