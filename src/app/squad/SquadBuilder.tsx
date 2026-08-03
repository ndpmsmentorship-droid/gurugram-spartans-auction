"use client";

import { useEffect, useState, type ReactNode } from "react";

const WARM = "linear-gradient(135deg, #FF8A3D 0%, #E0453A 100%)";
const WARM_INK = "#D2451F";
const GOLD = "#E3A81B";
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
};

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function SquadBuilder({
  players,
  signings = [],
  defaultBudget,
  squadSize,
  maxSquad,
  retainedCount,
  marquee,
  children,
}: {
  players: SquadPursePlayer[];
  signings?: Signing[];
  defaultBudget: number;
  squadSize: number; // positions shown in the full list (rest are bench cards)
  maxSquad: number;
  retainedCount: number;
  marquee?: ReactNode; // marquee "must buy" targets, rendered under the list
  children?: ReactNode; // player cards, rendered in the middle section
}) {
  const defaultCosts = Object.fromEntries(players.map((p) => [p.id, p.cost]));
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

  const spent = players.reduce((s, p) => s + (costs[p.id] ?? 0), 0);
  const remaining = budget - spent;
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
            <p className="mt-1 text-[0.72rem] text-muted">Spent on {players.length} retained</p>
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
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold">{player.name}</span>
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
                        </div>
                        <span className="truncate text-[0.72rem] text-muted">{player.role}</span>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold tabular-nums"
                        style={{
                          background: "color-mix(in srgb, #E0453A 12%, transparent)",
                          color: WARM_INK,
                        }}
                      >
                        {inr(costs[player.id] ?? 0)}
                      </span>
                    </>
                  ) : signing ? (
                    <>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold">{signing.name}</span>
                          <span
                            className="badge shrink-0"
                            style={{ background: "var(--accent)", color: "var(--ink)" }}
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
                        </div>
                        <span className="truncate text-[0.72rem] text-muted">
                          {signing.role ?? "—"}
                        </span>
                      </div>
                      {signing.price != null ? (
                        <span className="shrink-0 rounded-full bg-wash px-2.5 py-1 text-[0.72rem] font-semibold tabular-nums text-muted">
                          {inr(signing.price)}
                        </span>
                      ) : null}
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
              Mock buys — batting order
            </p>
            <div className="flex flex-col gap-1.5">
              {sortedSignings.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-[12px] bg-wash px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                  {s.isKeeper ? (
                    <span
                      className="badge shrink-0"
                      style={{ background: "var(--wash)", color: "var(--muted)" }}
                    >
                      WK
                    </span>
                  ) : null}
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label={`Batting order for ${s.name}`}
                    value={orders[s.id] ?? s.order ?? ""}
                    onChange={(e) => setOrder(s.id, Number(e.target.value) || 0)}
                    className="w-16 shrink-0 rounded-md bg-surface px-2 py-1 text-center text-sm tabular-nums outline-none focus:ring-2"
                    style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
                  />
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
