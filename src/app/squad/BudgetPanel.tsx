"use client";

import { useEffect, useState } from "react";

const WARM = "linear-gradient(135deg, #FF8A3D 0%, #E0453A 100%)";
const WARM_INK = "#D2451F";
const STORE_KEY = "spartans-budget-v1";

export type BudgetPlayer = { id: string; name: string; cost: number };

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function BudgetPanel({
  players,
  defaultBudget,
  minSquad,
  retainedCount,
}: {
  players: BudgetPlayer[];
  defaultBudget: number;
  minSquad: number;
  retainedCount: number;
}) {
  const defaultCosts = Object.fromEntries(players.map((p) => [p.id, p.cost]));
  const [budget, setBudget] = useState(defaultBudget);
  const [costs, setCosts] = useState<Record<string, number>>(defaultCosts);
  const [editing, setEditing] = useState(false);

  // load any saved overrides after mount (keeps SSR markup deterministic)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { budget?: number; costs?: Record<string, number> };
      if (typeof saved.budget === "number") setBudget(saved.budget);
      if (saved.costs) setCosts((c) => ({ ...c, ...saved.costs }));
    } catch {
      /* ignore bad storage */
    }
  }, []);

  const persist = (next: { budget: number; costs: Record<string, number> }) => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const setCost = (id: string, value: number) => {
    const next = { ...costs, [id]: value };
    setCosts(next);
    persist({ budget, costs: next });
  };
  const changeBudget = (value: number) => {
    setBudget(value);
    persist({ budget: value, costs });
  };
  const reset = () => {
    setBudget(defaultBudget);
    setCosts(defaultCosts);
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {
      /* ignore */
    }
  };

  const spent = players.reduce((s, p) => s + (costs[p.id] ?? 0), 0);
  const remaining = budget - spent;
  const openSlots = Math.max(0, minSquad - retainedCount);
  const perSlot = openSlots > 0 ? remaining / openSlots : 0;
  const pct = budget > 0 ? Math.min(100, Math.max(0, (spent / budget) * 100)) : 0;
  const over = remaining < 0;

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="eyebrow" style={{ color: WARM_INK }}>
            Purse &amp; retained cost
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
          across {openSlots} open slots (to a {minSquad}-player squad).
        </p>
      ) : null}

      {/* editable rows */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-2 rounded-[12px] bg-wash px-3 py-2 sm:col-span-2">
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
        {players.map((p) => (
          <label key={p.id} className="flex items-center justify-between gap-2 rounded-[12px] bg-wash px-3 py-2">
            <span className="truncate text-sm">{p.name}</span>
            <span className="flex items-center gap-1">
              <span className="text-muted">₹</span>
              <input
                type="number"
                inputMode="numeric"
                value={costs[p.id] ?? 0}
                disabled={!editing}
                onChange={(e) => setCost(p.id, Number(e.target.value) || 0)}
                className="w-20 rounded-md bg-surface px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2 disabled:opacity-70"
                style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
              />
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[0.68rem] text-muted">
        Edits save in this browser. Change the defaults for everyone in{" "}
        <code>retained.ts</code>.
      </p>
    </div>
  );
}
