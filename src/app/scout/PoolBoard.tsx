"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { RankedPlayer } from "@/lib/scout/ranks";
import type { RiskFlag } from "@/lib/scout/analytics";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/scout/category";
import { markBought, unmarkBought, setRejected, setMarquee } from "./actions";

export type PoolPlayer = RankedPlayer<{
  id: string;
  full_name: string;
  primary_role: string | null;
  cricheroes_link: string | null;
  is_keeper: boolean;
  is_bought: boolean;
  is_rejected: boolean;
  is_marquee: boolean;
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
  hasRecentForm: boolean;
  boundary_pct: number | null;
  fit_score: number;
  category: Category;
  categoryIsOverride: boolean;
};

type Col = {
  key: keyof PoolPlayer;
  label: string;
  // default sort direction when you first click the column
  asc: boolean;
  numeric?: boolean;
  help: string;
  fmt?: (p: PoolPlayer) => string;
};

const COLS: Col[] = [
  { key: "overall_rank", label: "#", asc: true, numeric: true, fmt: (p) => `${p.overall_rank}`,
    help: "Overall rank in the pool (1 = best), by the form-weighted overall index." },
  { key: "fit_score", label: "Fit", asc: false, numeric: true, fmt: (p) => `${Math.round(p.fit_score)}`,
    help: "Best fit for YOUR squad — the overall score boosted for roles you still need and dialled down for ones you've filled. Sort by this to see who to target next." },
  { key: "overall_index", label: "Overall", asc: false, numeric: true,
    help: "Overall player index, 0–100. A role-aware, form-weighted blend of the batting, bowling, fielding and keeping indices." },
  { key: "vor", label: "VOR", asc: false, numeric: true, fmt: (p) => `${p.vor >= 0 ? "+" : ""}${p.vor}`,
    help: "Value Over Replacement — points above a freely-available player in the same role. High VOR = scarce/premium; low or negative = plenty of similar options." },
  { key: "bat_index", label: "Bat", asc: false, numeric: true,
    help: "Batting index, 0–100 vs the pool: average, strike rate, boundary %, 50/100 conversion and finishing." },
  { key: "bowl_index", label: "Bowl", asc: false, numeric: true,
    help: "Bowling index, 0–100 vs the pool: economy, wickets per match, average, strike rate and dot balls." },
  { key: "field_index", label: "Field", asc: false, numeric: true,
    help: "Fielding index, 0–100: catches and run-outs per match." },
  { key: "bat_avg", label: "Avg", asc: false, numeric: true, help: "Batting average." },
  { key: "bat_sr", label: "SR", asc: false, numeric: true,
    help: "Strike rate (runs per 100 balls); form-weighted where recent data exists." },
  { key: "boundary_pct", label: "Bnd%", asc: false, numeric: true,
    help: "Boundary % — share of runs scored in 4s and 6s. High = boundary-reliant." },
  { key: "wickets", label: "Wkts", asc: false, numeric: true, help: "Career wickets." },
  { key: "economy", label: "Econ", asc: true, numeric: true, help: "Runs conceded per over (lower is better)." },
];

// Rank-tier colour code: top 10 = red, next 20 (11–30) = orange, rest = yellow.
// Solid pills so they read in both light and dark themes.
type RankTier = { label: string; bg: string; fg: string };
const RANK_TIERS: Record<"elite" | "strong" | "rest", RankTier> = {
  elite: { label: "Top 10", bg: "#E0453A", fg: "#ffffff" },
  strong: { label: "11–30", bg: "#F08A3D", fg: "#1d1d1f" },
  rest: { label: "31+", bg: "#E9C230", fg: "#1d1d1f" },
};

function rankTier(rank: number | null | undefined): RankTier | null {
  if (rank == null || rank >= 9999) return null;
  if (rank <= 10) return RANK_TIERS.elite;
  if (rank <= 30) return RANK_TIERS.strong;
  return RANK_TIERS.rest;
}

// which columns get the rank-tier colour code, and the rank they key off
const TIER_COL: Partial<Record<keyof PoolPlayer, keyof PoolPlayer>> = {
  bat_index: "bat_rank",
  bowl_index: "bowl_rank",
  field_index: "field_rank",
};

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
  const [category, setCategory] = useState<"All" | Category>("All");
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
        if (category !== "All" && p.category !== category) return false;
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
  }, [players, query, sortKey, sortAsc, role, category, avail]);

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
          className="input max-w-[11rem]"
          value={category}
          onChange={(e) => setCategory(e.target.value as "All" | Category)}
        >
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
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

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.72rem] text-muted">
        <span className="font-medium">Colour code — Bat, Bowl &amp; Field rank:</span>
        {(["elite", "strong", "rest"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: RANK_TIERS[k].bg }}
            />
            {k === "elite" ? "Top 10" : k === "strong" ? "Next 20 (11–30)" : "Rest (31+)"}
          </span>
        ))}
      </div>

      <details className="mb-3 text-sm">
        <summary className="cursor-pointer text-accent-text">
          What do the columns mean?
        </summary>
        <dl className="mt-2 grid gap-x-6 gap-y-1.5 rounded-[12px] bg-wash p-4 sm:grid-cols-2">
          {COLS.filter((c) => c.key !== "overall_rank").map((c) => (
            <div key={c.key as string} className="flex gap-2">
              <dt className="shrink-0 font-medium">{c.label}</dt>
              <dd className="text-muted">{c.help}</dd>
            </div>
          ))}
        </dl>
      </details>

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
                  className={`cursor-help select-none whitespace-nowrap px-2 py-2 font-medium hover:text-accent-text ${
                    c.numeric ? "text-right" : ""
                  } ${sortKey === c.key ? "text-accent-text" : ""}`}
                  title={`${c.help}\n\n(Click to sort)`}
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
        {p.is_marquee && (
          <span
            className="ml-1 align-middle text-[11px] font-semibold"
            style={{ color: "#B4820F" }}
            title="Marquee — must buy"
          >
            ★ Marquee
          </span>
        )}
        {p.hasRecentForm && (
          <span
            className="ml-1 align-middle text-[10px] font-semibold text-up"
            title="Score is form-adjusted (recent 2-year data captured)"
          >
            ● Form
          </span>
        )}
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: CATEGORY_META[p.category].bg, color: CATEGORY_META[p.category].fg }}
            title={
              p.categoryIsOverride
                ? "Category set manually"
                : "Auto-derived category — open the player to override"
            }
          >
            {p.category}
          </span>
          {!p.categoryIsOverride && (
            <span className="text-[9px] uppercase tracking-wide text-muted">auto</span>
          )}
        </span>
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
      {COLS.map((c) => {
        const rankKey = TIER_COL[c.key];
        const tier = rankKey ? rankTier(p[rankKey] as number | null) : null;
        return (
          <td
            key={c.key as string}
            className={`whitespace-nowrap px-2 py-2 tabular-nums ${
              c.numeric ? "text-right" : ""
            } ${c.key === "boundary_pct" ? "font-medium text-accent-text" : ""}`}
          >
            {tier ? (
              <span
                className="inline-block min-w-[2.1rem] rounded-full px-2 py-0.5 text-center text-[0.78rem] font-semibold"
                style={{ background: tier.bg, color: tier.fg }}
                title={`${c.label} rank tier: ${tier.label}`}
              >
                {cell(p, c)}
              </span>
            ) : (
              cell(p, c)
            )}
          </td>
        );
      })}
      <td className="whitespace-nowrap px-2 py-2 text-right">
        <span className="inline-flex items-center justify-end gap-2">
          <button
            onClick={() =>
              startTransition(async () => {
                const res = await setMarquee(p.id, !p.is_marquee);
                if (res.error)
                  alert(
                    `Couldn't mark marquee: ${res.error}\n\nIf this mentions "is_marquee", run supabase/scout_category.sql in Supabase first.`
                  );
              })
            }
            disabled={pending}
            title={p.is_marquee ? "Unmark marquee" : "Mark as marquee (must buy)"}
            className="text-base leading-none transition-transform hover:scale-110"
            style={{ color: p.is_marquee ? "#E3A81B" : "var(--muted)" }}
          >
            {p.is_marquee ? "★" : "☆"}
          </button>
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
              onClick={() =>
                startTransition(async () => {
                  await markBought(p.id, 2000);
                })
              }
              disabled={pending}
              title="Dummy buy at base (₹2,000) — adds to the pseudo squad"
              className="text-xs font-medium hover:underline"
              style={{ color: "#D2451F" }}
            >
              ⚡ Buy
            </button>
            <button
              onClick={() => setBuying(true)}
              className="text-xs font-medium text-accent-text hover:underline"
            >
              Buy ₹
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
        </span>
      </td>
    </tr>
  );
}
