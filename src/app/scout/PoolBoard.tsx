"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { RankedPlayer } from "@/lib/scout/ranks";
import type { RiskFlag } from "@/lib/scout/analytics";
import { CATEGORIES, type Category } from "@/lib/scout/category";
import { tierStyle, parseTier, isGradeA } from "@/lib/scout/tier";
import {
  setMarquee,
  setRegStatus,
  type RegStatus,
} from "./actions";

export type PoolPlayer = RankedPlayer<{
  id: string;
  full_name: string;
  primary_role: string | null;
  auction_category: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  cricheroes_link: string | null;
  is_keeper: boolean;
  is_bought: boolean;
  is_rejected: boolean;
  sold: boolean;
  is_marquee: boolean;
  reg_status: string; // 'registered' | 'verified' | 'rejected'
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
  boundary_pct: number | null; // batting: share of runs in 4s/6s
  dot_pct: number | null; // bowling: dot balls / balls (higher better)
  bowl_boundary_pct: number | null; // bowling: boundaries conceded / balls (lower better)
  field_ratio: number | null; // fielding: catches + run-outs per match
  // per-metric ranks (1 = best) for the top-10/11–30 colour code
  bnd_rank: number;
  dot_pct_rank: number;
  bowl_bnd_rank: number;
  field_ratio_rank: number;
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
  { key: "boundary_pct", label: "Bat Bnd%", asc: false, numeric: true,
    help: "Batting boundary % — share of runs scored in 4s and 6s. High = boundary-reliant. Colour ranks batters with 100+ career runs." },
  { key: "dot_pct", label: "Dot%", asc: false, numeric: true,
    help: "Bowling dot-ball % — dot balls as a share of balls bowled. Higher = more pressure. Colour ranks bowlers with 10+ overs." },
  { key: "bowl_boundary_pct", label: "Conc%", asc: true, numeric: true,
    help: "Boundary conceded % — 4s+6s hit off the bowler as a share of balls bowled. LOWER is better (sorts low-first). Needs the bowl_fours/bowl_sixes data — blank until that's loaded." },
  { key: "field_ratio", label: "Fld/M", asc: false, numeric: true, fmt: (p) => p.field_ratio == null ? "—" : p.field_ratio.toFixed(2),
    help: "Fielding per match — catches + run-outs divided by matches played. Colour ranks fielders with 3+ matches." },
  { key: "wickets", label: "Wkts", asc: false, numeric: true, help: "Career wickets." },
  { key: "economy", label: "Econ", asc: true, numeric: true, help: "Runs conceded per over (lower is better)." },
];

// Rank-tier colour code: only the top 30 are coloured — top 10 = red, next 20
// (11–30) = orange. Everyone 31+ shows a plain, uncoloured score.
// Solid pills so they read in both light and dark themes.
type RankTier = { label: string; bg: string; fg: string };
const RANK_TIERS: Record<"elite" | "strong", RankTier> = {
  elite: { label: "Top 10", bg: "#E0453A", fg: "#ffffff" },
  strong: { label: "11–30", bg: "#F08A3D", fg: "#1d1d1f" },
};

function rankTier(rank: number | null | undefined): RankTier | null {
  if (rank == null || rank >= 9999) return null;
  if (rank <= 10) return RANK_TIERS.elite;
  if (rank <= 30) return RANK_TIERS.strong;
  return null; // 31+ — no colour
}

// Organizers' auction-tier filter: coarse A/B grade + the four exact tiers.
type TierFilter = "All" | "A" | "B" | "U35A" | "35+A" | "U35B" | "35+B";
const TIER_FILTERS: TierFilter[] = ["All", "A", "B", "U35A", "35+A", "U35B", "35+B"];
function matchesTier(auctionCategory: string | null, f: TierFilter): boolean {
  if (f === "All") return true;
  if (f === "A") return isGradeA(auctionCategory);
  if (f === "B") return parseTier(auctionCategory).grade === "B";
  return (auctionCategory ?? "").toUpperCase().replace(/\s+/g, "") === f;
}

// which columns get the rank-tier colour code, and the rank they key off
const TIER_COL: Partial<Record<keyof PoolPlayer, keyof PoolPlayer>> = {
  bat_index: "bat_rank",
  bowl_index: "bowl_rank",
  field_index: "field_rank",
  boundary_pct: "bnd_rank",
  dot_pct: "dot_pct_rank",
  bowl_boundary_pct: "bowl_bnd_rank",
  field_ratio: "field_ratio_rank",
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
  const [tier, setTier] = useState<TierFilter>("All");
  const [status, setStatus] = useState<"All" | RegStatus>("All");
  const [avail, setAvail] = useState<"all" | "sold" | "unsold">("all");

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
        if (!matchesTier(p.auction_category, tier)) return false;
        if (status !== "All" && (p.reg_status ?? "registered") !== status) return false;
        if (avail === "sold" && !p.sold) return false;
        if (avail === "unsold" && p.sold) return false;
        return true;
      })
      .sort((a, b) => {
        const av = (a[sortKey] ?? (sortAsc ? 1e9 : -1e9)) as number;
        const bv = (b[sortKey] ?? (sortAsc ? 1e9 : -1e9)) as number;
        return sortAsc ? av - bv : bv - av;
      });
  }, [players, query, sortKey, sortAsc, role, category, tier, status, avail]);

  const statusCounts = useMemo(() => {
    const c = { registered: 0, verified: 0, rejected: 0 } as Record<RegStatus, number>;
    for (const p of players) {
      const s = (p.reg_status ?? "registered") as RegStatus;
      if (s in c) c[s]++;
    }
    return c;
  }, [players]);

  const tierCounts = useMemo(() => {
    const c: Record<string, number> = { A: 0, B: 0, U35A: 0, "35+A": 0, U35B: 0, "35+B": 0 };
    for (const p of players) {
      if (isGradeA(p.auction_category)) c.A++;
      if (parseTier(p.auction_category).grade === "B") c.B++;
      const key = (p.auction_category ?? "").toUpperCase().replace(/\s+/g, "");
      if (key in c) c[key]++;
    }
    return c;
  }, [players]);

  return (
    <div className="mt-5">
      {/* Major filter — organizers' auction tier (analyse A vs B separately) */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[0.72rem] font-semibold uppercase tracking-wide text-muted">
          Auction tier
        </span>
        {TIER_FILTERS.map((t) => {
          const active = tier === t;
          const solid =
            t === "All"
              ? { bg: "var(--ink)", fg: "var(--surface)" }
              : t === "A"
                ? { bg: "#E0453A", fg: "#ffffff" }
                : t === "B"
                  ? { bg: "#5B6270", fg: "#ffffff" }
                  : (tierStyle(t) ?? { bg: "var(--ink)", fg: "var(--surface)" });
          return (
            <button
              key={t}
              onClick={() => setTier(t)}
              className="rounded-full px-3 py-1 text-[0.78rem] font-semibold transition-colors"
              style={
                active
                  ? { background: solid.bg, color: solid.fg }
                  : {
                      background: "var(--wash)",
                      color: "var(--muted)",
                      boxShadow: "inset 0 0 0 1px var(--border)",
                    }
              }
            >
              {t === "All" ? "All tiers" : t}
              {t !== "All" ? (
                <span className="ml-1.5 tabular-nums opacity-70">{tierCounts[t]}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Registration status — the auction-day showcase axis */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[0.72rem] font-semibold uppercase tracking-wide text-muted">
          Status
        </span>
        {(["All", "registered", "verified", "rejected"] as const).map((s) => {
          const active = status === s;
          const solid =
            s === "All"
              ? { bg: "var(--ink)", fg: "var(--surface)" }
              : s === "registered"
                ? { bg: "var(--accent)", fg: "#ffffff" }
                : s === "verified"
                  ? { bg: "var(--up)", fg: "#ffffff" }
                  : { bg: "var(--down)", fg: "#ffffff" };
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className="rounded-full px-3 py-1 text-[0.78rem] font-semibold capitalize transition-colors"
              style={
                active
                  ? { background: solid.bg, color: solid.fg }
                  : {
                      background: "var(--wash)",
                      color: "var(--muted)",
                      boxShadow: "inset 0 0 0 1px var(--border)",
                    }
              }
            >
              {s === "All" ? "All" : s}
              {s !== "All" ? (
                <span className="ml-1.5 tabular-nums opacity-70">{statusCounts[s]}</span>
              ) : null}
            </button>
          );
        })}
      </div>

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
        <div className="inline-flex overflow-hidden rounded-lg border border-border text-sm">
          {(["all", "unsold", "sold"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setAvail(opt)}
              className={`px-3 py-1.5 capitalize transition ${
                avail === opt ? "bg-accent font-semibold text-white" : "hover:bg-wash"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        <span className="self-center text-xs text-muted">{filtered.length} shown</span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.72rem] text-muted">
        <span className="font-medium">Colour code — Bat, Bowl &amp; Field rank (top 30 only):</span>
        {(["elite", "strong"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: RANK_TIERS[k].bg }}
            />
            {k === "elite" ? "Top 10" : "Next 20 (11–30)"}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ boxShadow: "inset 0 0 0 1px var(--border)" }} />
          31+ (no colour)
        </span>
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
                  className={`cursor-help select-none whitespace-nowrap px-3 py-2 font-medium hover:text-accent-text ${
                    c.numeric ? "text-right" : ""
                  } ${sortKey === c.key ? "text-accent-text" : ""}`}
                  title={`${c.help}\n\n(Click to sort)`}
                >
                  {c.label}
                  {sortKey === c.key ? (sortAsc ? " ↑" : " ↓") : ""}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Action</th>
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
  const [pending, startTransition] = useTransition();

  const rowTint = p.sold
    ? "bg-wash text-muted"
    : p.is_rejected
      ? "opacity-50"
      : "";

  return (
    <tr className={`border-t border-border ${rowTint}`}>
      <td className="sticky left-0 z-10 max-w-[230px] bg-[var(--surface)] px-3 py-1.5 align-middle">
        <div className="flex items-center gap-1.5 leading-tight">
          {(() => {
            const ts = tierStyle(p.auction_category);
            return ts ? (
              <span
                className="shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide"
                style={{ background: ts.bg, color: ts.fg }}
                title="Organizers' auction category"
              >
                {p.auction_category}
              </span>
            ) : null;
          })()}
          <Link
            href={`/scout/${p.id}`}
            className="min-w-0 truncate font-medium hover:text-accent-text"
          >
            {p.full_name}
          </Link>
          {p.is_marquee && (
            <span
              className="shrink-0 text-xs leading-none"
              style={{ color: "#E3A81B" }}
              title="Marquee — must buy"
            >
              ★
            </span>
          )}
          {p.hasRecentForm && (
            <span
              className="shrink-0 text-[10px] leading-none text-up"
              title="Score is form-adjusted (recent 2-year data captured)"
            >
              ●
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[11px] leading-tight text-muted">
          {p.archetype}
          {p.topRisk && (
            <span className={p.topRisk.level === "red" ? "ml-1 text-down" : "ml-1 text-accent-text"}>
              · {p.topRisk.label}
            </span>
          )}
        </div>
      </td>
      {COLS.map((c) => {
        const rankKey = TIER_COL[c.key];
        const tier = rankKey ? rankTier(p[rankKey] as number | null) : null;
        return (
          <td
            key={c.key as string}
            className={`whitespace-nowrap px-3 py-1.5 align-middle tabular-nums ${
              c.numeric ? "text-right" : ""
            }`}
          >
            {tier ? (
              <span
                className="font-semibold"
                style={{ color: tier.bg }}
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
      <td className="whitespace-nowrap px-3 py-1.5 text-right align-middle">
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
                await setRegStatus(p.id, "registered");
              })
            }
            disabled={pending}
            className="text-xs text-muted hover:text-accent-text"
          >
            Restore
          </button>
        ) : p.sold ? (
          <span className="badge bg-wash text-muted">Sold</span>
        ) : (
          <button
            onClick={() =>
              startTransition(async () => {
                await setRegStatus(p.id, "rejected");
              })
            }
            disabled={pending}
            className="text-xs text-muted hover:text-down"
          >
            Reject
          </button>
        )}
        </span>
      </td>
    </tr>
  );
}
