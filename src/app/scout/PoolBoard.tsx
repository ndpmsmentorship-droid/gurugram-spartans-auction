"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { RankedPlayer } from "@/lib/scout/ranks";
import type { RiskFlag } from "@/lib/scout/analytics";
import { markBought, unmarkBought, setRejected } from "./actions";

export type PoolPlayer = RankedPlayer<{
  id: string;
  full_name: string;
  primary_role: string | null;
  cricheroes_link: string | null;
  is_keeper: boolean;
  is_bought: boolean;
  is_rejected: boolean;
  bought_price: number | null;
  bat_index: number | null;
  bowl_index: number | null;
  field_index: number | null;
  keep_index: number | null;
  overall_index: number | null;
  bat_avg: number | null;
  bat_sr: number | null;
  runs: number | null;
  wickets: number | null;
  economy: number | null;
}> & {
  archetype: string;
  vor: number;
  topRisk: RiskFlag | null;
  boundary_pct: number | null;
  fit_score: number;
};

type Col = {
  key: keyof PoolPlayer;
  label: string;
  // default sort direction when you first click the column
  asc: boolean;
  numeric?: boolean;
  fmt?: (p: PoolPlayer) => string;
};

const COLS: Col[] = [
  { key: "overall_rank", label: "#", asc: true, numeric: true, fmt: (p) => `${p.overall_rank}` },
  { key: "fit_score", label: "Fit", asc: false, numeric: true, fmt: (p) => `${Math.round(p.fit_score)}` },
  { key: "overall_index", label: "Overall", asc: false, numeric: true },
  { key: "vor", label: "VOR", asc: false, numeric: true, fmt: (p) => `${p.vor >= 0 ? "+" : ""}${p.vor}` },
  { key: "bat_index", label: "Bat", asc: false, numeric: true },
  { key: "bowl_index", label: "Bowl", asc: false, numeric: true },
  { key: "field_index", label: "Field", asc: false, numeric: true },
  { key: "bat_avg", label: "Avg", asc: false, numeric: true },
  { key: "bat_sr", label: "SR", asc: false, numeric: true },
  { key: "boundary_pct", label: "Bnd%", asc: false, numeric: true },
  { key: "wickets", label: "Wkts", asc: false, numeric: true },
  { key: "economy", label: "Econ", asc: true, numeric: true },
];

function roleGroup(role: string | null, isKeeper: boolean): string {
  if (isKeeper) return "Keeper";
  const r = (role ?? "").toLowerCase();
  if (r.includes("keep")) return "Keeper";
  if (r.includes("all")) return "All-rounder";
  if (r.includes("bowl") || r.includes("spin") || r.includes("fast")) return "Bowler";
  if (r.includes("bat")) return "Batter";
  return "Other";
}

const ROLE_FILTERS = ["All", "Batter", "Bowler", "All-rounder", "Keeper"];

const cell = (p: PoolPlayer, c: Col): string => {
  if (c.fmt) return c.fmt(p);
  const v = p[c.key];
  if (v == null) return "—";
  return c.numeric ? `${Math.round(Number(v) * 10) / 10}` : String(v);
};

export default function PoolBoard({ players }: { players: PoolPlayer[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof PoolPlayer>("fit_score");
  const [sortAsc, setSortAsc] = useState(false);
  const [role, setRole] = useState("All");
  const [avail, setAvail] = useState<"available" | "bought" | "rejected" | "all">(
    "available"
  );

  function toggleSort(c: Col) {
    if (sortKey === c.key) setSortAsc((v) => !v);
    else {
      setSortKey(c.key);
      setSortAsc(c.asc);
    }
  }

  const filtered = useMemo(() => {
    return players
      .filter((p) => {
        if (query && !p.full_name.toLowerCase().includes(query.toLowerCase()))
          return false;
        if (role !== "All" && roleGroup(p.primary_role, p.is_keeper) !== role)
          return false;
        if (avail === "available" && (p.is_bought || p.is_rejected)) return false;
        if (avail === "bought" && !p.is_bought) return false;
        if (avail === "rejected" && !p.is_rejected) return false;
        return true;
      })
      .sort((a, b) => {
        const av = (a[sortKey] ?? (sortAsc ? 1e9 : -1e9)) as number;
        const bv = (b[sortKey] ?? (sortAsc ? 1e9 : -1e9)) as number;
        return sortAsc ? av - bv : bv - av;
      });
  }, [players, query, sortKey, sortAsc, role, avail]);

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          className="input max-w-[12rem]"
          placeholder="Search player…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input max-w-[9rem]"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {ROLE_FILTERS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          className="input max-w-[9rem]"
          value={avail}
          onChange={(e) => setAvail(e.target.value as typeof avail)}
        >
          <option value="available">Available</option>
          <option value="bought">Bought</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        <span className="self-center text-xs text-muted">{filtered.length} shown</span>
      </div>

      <div className="overflow-x-auto rounded-[16px] border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-wash text-left">
            <tr>
              <th className="sticky left-0 z-10 bg-wash px-3 py-2 font-medium">
                Player
              </th>
              {COLS.map((c) => (
                <th
                  key={c.key as string}
                  onClick={() => toggleSort(c)}
                  className={`cursor-pointer select-none whitespace-nowrap px-2 py-2 font-medium hover:text-accent-text ${
                    c.numeric ? "text-right" : ""
                  } ${sortKey === c.key ? "text-accent-text" : ""}`}
                  title={`Sort by ${c.label}`}
                >
                  {c.label}
                  {sortKey === c.key ? (sortAsc ? " ↑" : " ↓") : ""}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <Row key={p.id} p={p} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-6 text-center text-muted">No players match.</p>
        )}
      </div>
    </div>
  );
}

function Row({ p }: { p: PoolPlayer }) {
  const [buying, setBuying] = useState(false);
  const [price, setPrice] = useState("");
  const [pending, startTransition] = useTransition();

  function confirmBuy() {
    const val = Number(price);
    if (!Number.isFinite(val) || val <= 0) return;
    startTransition(async () => {
      await markBought(p.id, val);
      setBuying(false);
      setPrice("");
    });
  }

  const rowTint = p.is_bought
    ? "bg-wash"
    : p.is_rejected
      ? "opacity-50"
      : "";

  return (
    <tr className={`border-t border-border ${rowTint}`}>
      <td className="sticky left-0 z-10 bg-[var(--surface)] px-3 py-2">
        <Link href={`/scout/${p.id}`} className="font-medium hover:text-accent-text">
          {p.full_name}
        </Link>
        <span className="block text-[11px] text-muted">
          {p.archetype}
          {p.topRisk && (
            <span
              className={
                p.topRisk.level === "red" ? "ml-1 text-down" : "ml-1 text-accent-text"
              }
            >
              · {p.topRisk.label}
            </span>
          )}
        </span>
      </td>
      {COLS.map((c) => (
        <td
          key={c.key as string}
          className={`whitespace-nowrap px-2 py-2 tabular-nums ${
            c.numeric ? "text-right" : ""
          } ${c.key === "boundary_pct" ? "font-medium text-accent-text" : ""}`}
        >
          {cell(p, c)}
        </td>
      ))}
      <td className="whitespace-nowrap px-2 py-2 text-right">
        {p.is_rejected ? (
          <button
            onClick={() =>
              startTransition(async () => {
                await setRejected(p.id, false);
              })
            }
            disabled={pending}
            className="text-xs text-muted hover:text-accent-text"
          >
            Restore
          </button>
        ) : p.is_bought ? (
          <span className="inline-flex items-center gap-2">
            <span className="badge bg-accent text-ink">
              {p.bought_price?.toLocaleString()}
            </span>
            <button
              onClick={() =>
                startTransition(async () => {
                  await unmarkBought(p.id);
                })
              }
              disabled={pending}
              className="text-xs text-muted hover:text-down"
            >
              Undo
            </button>
          </span>
        ) : buying ? (
          <span className="inline-flex items-center gap-1">
            <input
              type="number"
              autoFocus
              className="input w-20 py-1"
              placeholder="₹"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmBuy()}
            />
            <button onClick={confirmBuy} disabled={pending} className="text-xs text-accent-text">
              ✓
            </button>
            <button onClick={() => setBuying(false)} className="text-xs text-muted">
              ✕
            </button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <button
              onClick={() => setBuying(true)}
              className="text-xs font-medium text-accent-text hover:underline"
            >
              Buy
            </button>
            <button
              onClick={() =>
                startTransition(async () => {
                  await setRejected(p.id, true);
                })
              }
              disabled={pending}
              className="text-xs text-muted hover:text-down"
            >
              Reject
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}
