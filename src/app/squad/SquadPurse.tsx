"use client";

import { useEffect, useState } from "react";

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
};

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function SquadPurse({
  players,
  defaultBudget,
  maxSquad,
  retainedCount,
}: {
  players: SquadPursePlayer[];
  defaultBudget: number;
  maxSquad: number;
  retainedCount: number;
}) {
  const defaultCosts = Object.fromEntries(players.map((p) => [p.id, p.cost]));
  const defaultOrders = Object.fromEntries(players.map((p) => [p.id, p.order]));
  const [budget, setBudget] = useState(defaultBudget);
  const [costs, setCosts] = useState<Record<string, number>>(defaultCosts);
  const [orders, setOrders] = useState<Record<string, number>>(defaultOrders);
  const [editing, setEditing] = useState(false);

  // Load any saved overrides *after* mount so the SSR/first-client markup stays
  // deterministic (reading localStorage during render would hydration-mismatch).
  // The one-shot setState here is deliberate, hence the scoped disable.
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
  const positions = Array.from({ length: maxSquad }, (_, i) => i + 1);

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="eyebrow" style={{ color: WARM_INK }}>
            Probable order &amp; purse
          </p>
          <span
            className="badge"
            style={{ background: "color-mix(in srgb, #E0453A 14%, transparent)", color: WARM_INK }}
          >
            editable
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button onClick={() => setEditing((v) => !v)} className="font-medium" style={{ color: WARM_INK }}>
            {editing ? "Done" : "Edit"}
          </button>
          <button onClick={reset} className="text-muted hover:underline">
            Reset
          </button>
        </div>
      </div>

      {/* headline: spent / budget */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-bold leading-none">
            {inr(spent)} <span className="text-base font-semibold text-muted">/ {inr(budget)}</span>
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
      </div>

      {/* bar */}
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--wash)", boxShadow: "inset 0 0 0 1px var(--border)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? "var(--down)" : WARM }} />
      </div>
      {openSlots > 0 ? (
        <p className="mt-2 text-[0.72rem] text-muted">
          {over ? "Trim costs — you're over the cap. " : `${inr(perSlot)} per slot `}
          across {openSlots} open slots (to a {maxSquad}-player squad).
        </p>
      ) : null}

      {/* total purse cap */}
      <label className="mt-4 flex items-center justify-between gap-2 rounded-[12px] bg-wash px-3 py-2">
        <span className="text-sm font-medium">Total purse (cap)</span>
        <span className="flex items-center gap-1">
          <span className="text-muted">₹</span>
          <input
            type="number"
            inputMode="numeric"
            value={budget}
            disabled={!editing}
            onChange={(e) => changeBudget(Number(e.target.value) || 0)}
            className="w-28 rounded-md bg-surface px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2 disabled:opacity-70"
            style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
          />
        </span>
      </label>

      {/* probable batting order (1..maxSquad) with editable order + retention */}
      <div className="mt-4">
        <div className="flex items-center gap-3 px-1 pb-1.5 text-[0.62rem] font-medium uppercase tracking-wide text-muted">
          <span className="w-7 shrink-0 text-center">#</span>
          <span className="flex-1">Player</span>
          <span className="w-14 shrink-0 text-center">Order</span>
          <span className="w-24 shrink-0 text-right">Retention</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {positions.map((pos) => {
            const player = byPosition.get(pos) ?? null;
            return (
              <div
                key={pos}
                className="flex items-center gap-3 rounded-[12px] bg-wash px-3 py-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface font-display text-[0.8rem] font-bold tabular-nums text-muted" style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}>
                  {pos}
                </span>

                {player ? (
                  <>
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="truncate font-medium">{player.name}</span>
                      {player.isCaptain ? (
                        <span className="badge shrink-0" style={{ background: GOLD, color: "#1d1d1f" }}>
                          C
                        </span>
                      ) : null}
                      {player.isKeeper ? (
                        <span className="badge shrink-0" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                          WK
                        </span>
                      ) : null}
                      <span className="ml-1 hidden shrink-0 truncate text-[0.72rem] text-muted sm:inline">
                        {player.role}
                      </span>
                    </div>

                    <input
                      type="number"
                      inputMode="numeric"
                      aria-label={`Batting order for ${player.name}`}
                      value={orders[player.id] ?? player.order}
                      disabled={!editing}
                      onChange={(e) => setOrder(player.id, Number(e.target.value) || 0)}
                      className="w-14 shrink-0 rounded-md bg-surface px-2 py-1 text-center text-sm tabular-nums outline-none focus:ring-2 disabled:opacity-70"
                      style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
                    />

                    <span className="flex w-24 shrink-0 items-center justify-end gap-1">
                      <span className="text-muted">₹</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        aria-label={`Retention amount for ${player.name}`}
                        value={costs[player.id] ?? 0}
                        disabled={!editing}
                        onChange={(e) => setCost(player.id, Number(e.target.value) || 0)}
                        className="w-full rounded-md bg-surface px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2 disabled:opacity-70"
                        style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
                      />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-[0.85rem] italic text-muted">Open — target at auction</span>
                    <span className="w-14 shrink-0 text-center text-muted">—</span>
                    <span className="w-24 shrink-0 text-right text-muted">—</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[0.68rem] text-muted">
        Batting order and retention amounts save in this browser. Change the defaults for everyone in{" "}
        <code>retained.ts</code>.
      </p>
    </div>
  );
}
