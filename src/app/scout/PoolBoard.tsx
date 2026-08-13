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

// Rank-tier colour code: only the top 30 are coloured — top 10 = brand red,
// next 20 (11–30) = marquee gold. Everyone 31+ shows a plain, uncoloured score.
// Tokens, so both themes are handled for free.
type RankTier = { label: string; bg: string; fg: string };
const RANK_TIERS: Record<"elite" | "strong", RankTier> = {
  elite: { label: "Top 10", bg: "var(--red)", fg: "#ffffff" },
  strong: { label: "11–30", bg: "var(--gold)", fg: "#ffffff" },
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
    <div className="mt-6">
      {/* One rail: auction tier, then the sold/unsold split, then search —
          the shape used in the design comp. */}
      <div className="flex flex-wrap items-center gap-2">
        {TIER_FILTERS.map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            data-active={tier === t}
            className="pill"
          >
            {t === "All" ? "All tiers" : t}
            {t !== "All" ? (
              <span className="num text-[0.625rem] opacity-70">{tierCounts[t]}</span>
            ) : null}
          </button>
        ))}

        <span className="mx-1 h-6 w-px shrink-0 bg-line" />

        {(["all", "unsold", "sold"] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setAvail(opt)}
            data-active={avail === opt}
            className="pill capitalize"
          >
            {opt}
          </button>
        ))}

        <div className="relative ml-auto min-w-[15rem]">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[0.875rem] text-faint">
            ⌕
          </span>
          <input
            className="input with-icon"
            placeholder="Search player…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Secondary axes stay available but are visually quieter than the tier rail. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {(["All", "registered", "verified", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            data-active={status === s}
            className="pill capitalize"
          >
            {s === "All" ? "All statuses" : s}
            {s !== "All" ? (
              <span className="num text-[0.625rem] opacity-70">{statusCounts[s]}</span>
            ) : null}
          </button>
        ))}
        <select
          className="input max-w-[9rem] py-2"
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
          className="input max-w-[11rem] py-2"
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
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="text-[0.75rem] text-muted">
          Rank colour (Bat · Bowl · Field)
        </span>
        {(["elite", "strong"] as const).map((k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1.5 text-[0.75rem] text-muted"
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: RANK_TIERS[k].bg }}
            />
            {k === "elite" ? "Top 10" : "11–30"}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-muted">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ boxShadow: "inset 0 0 0 1px var(--line2)" }}
          />
          31+
        </span>
        <span className="num ml-auto text-[0.75rem] text-faint">
          {filtered.length} shown
        </span>
      </div>

      <details className="group mt-2">
        <summary className="cursor-pointer list-none text-[0.75rem] text-muted transition hover:text-red">
          <span className="inline-block transition group-open:rotate-90">▸</span> What
          do the columns mean?
        </summary>
        <dl className="mt-2 grid gap-x-6 gap-y-2 rounded-[12px] border border-line bg-wash p-4 text-[0.813rem] sm:grid-cols-2">
          {COLS.filter((c) => c.key !== "overall_rank").map((c) => (
            <div key={c.key as string} className="flex gap-2">
              <dt className="label-mono shrink-0 pt-0.5 !text-red">{c.label}</dt>
              <dd className="text-muted">{c.help}</dd>
            </div>
          ))}
        </dl>
      </details>

      {/* Header row and player column both pin, so a 766-row pool stays
          readable while you scan sideways to Econ on auction day. */}
      <div
        className="mt-4 max-h-[calc(100vh-13rem)] overflow-auto rounded-[12px] border border-line"
        style={{ background: "var(--surface)" }}
      >
        <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-[0.813rem]">
          <thead className="text-left">
            <tr>
              {/* fixed width: a content-sized sticky column lets the next
                  column's digits peek out beside it while scrolling */}
              <th
                className="label-mono sticky left-0 top-0 z-30 w-[270px] min-w-[270px] border-b border-line px-5 py-3.5 text-left"
                style={{ background: "var(--wash)" }}
              >
                Player
              </th>
              {COLS.map((c) => (
                <th
                  key={c.key as string}
                  onClick={() => toggleSort(c)}
                  className={`label-mono sticky top-0 z-20 cursor-pointer select-none whitespace-nowrap border-b border-line px-3 py-3.5 transition hover:!text-red ${
                    c.numeric ? "text-right" : ""
                  } ${sortKey === c.key ? "!text-red" : ""}`}
                  style={{ background: "var(--wash)" }}
                  title={`${c.help}\n\n(Click to sort)`}
                >
                  {c.label}
                  {sortKey === c.key ? (sortAsc ? " ↓" : " ↑") : ""}
                </th>
              ))}
              <th
                className="label-mono sticky top-0 z-20 border-b border-line px-5 py-3.5 text-right"
                style={{ background: "var(--wash)" }}
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <Row key={p.id} p={p} zebra={i % 2 === 1} sortKey={sortKey} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-8 text-center text-[0.813rem] text-muted">No players match.</p>
        )}
      </div>
    </div>
  );
}

// The three columns that actually drive an auction-day decision — they get
// display weight; the raw career stats stay quiet mono.
const DECISION_COLS = new Set<keyof PoolPlayer>(["fit_score", "overall_index", "vor"]);

function Row({
  p,
  zebra,
  sortKey,
}: {
  p: PoolPlayer;
  zebra: boolean;
  sortKey: keyof PoolPlayer;
}) {
  const [pending, startTransition] = useTransition();

  // One background per row, shared with the pinned name cell so the two never
  // disagree while scrolling sideways. Must be OPAQUE — the pinned cell paints
  // over the row, so a translucent value composites twice and shows a seam.
  // Sold players are out of contention, so they RECEDE.
  const rowBg = zebra ? "var(--zebra)" : "var(--surface)";

  return (
    <tr
      className={`border-line ${p.sold ? "opacity-45" : ""} ${p.is_rejected ? "opacity-30" : ""}`}
      style={{ background: rowBg }}
    >
      <td
        className="sticky left-0 z-10 w-[270px] min-w-[270px] max-w-[270px] border-b border-line px-5 py-3 align-middle"
        style={{ background: rowBg }}
      >
        <div className="flex items-center gap-2.5 leading-tight">
          {(() => {
            const ts = tierStyle(p.auction_category);
            return ts ? (
              <span
                className="num shrink-0 rounded-full px-2 py-[3px] text-[0.594rem] font-medium uppercase tracking-[0.06em]"
                style={{ background: ts.bg, color: ts.fg }}
                title="Organizers' auction category"
              >
                {p.auction_category}
              </span>
            ) : null;
          })()}
          <Link
            href={`/scout/${p.id}`}
            className="min-w-0 truncate text-[0.938rem] font-normal text-ink transition hover:text-red"
          >
            {p.full_name}
          </Link>
          {p.is_marquee && (
            <span
              className="shrink-0 text-[0.75rem] leading-none text-gold"
              title="Marquee — must buy"
            >
              ★
            </span>
          )}
          {p.hasRecentForm && (
            <span
              className="shrink-0 text-[0.625rem] leading-none text-up"
              title="Score is form-adjusted (recent 2-year data captured)"
            >
              ●
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-[0.75rem] leading-tight text-muted">
          {p.archetype}
          {p.topRisk && (
            <span className={p.topRisk.level === "red" ? "ml-1 text-down" : "ml-1 text-gold"}>
              · {p.topRisk.label}
            </span>
          )}
        </div>
      </td>
      {COLS.map((c) => {
        const rankKey = TIER_COL[c.key];
        const tier = rankKey ? rankTier(p[rankKey] as number | null) : null;
        const isDecision = DECISION_COLS.has(c.key);
        return (
          <td
            key={c.key as string}
            className={`num whitespace-nowrap border-b border-line px-3 py-3 align-middle text-[0.813rem] ${
              c.numeric ? "text-right" : ""
            } ${sortKey === c.key ? "text-ink" : "text-muted"}`}
          >
            {tier ? (
              <span
                className="font-medium"
                style={{ color: tier.bg }}
                title={`${c.label} rank tier: ${tier.label}`}
              >
                {cell(p, c)}
              </span>
            ) : isDecision ? (
              <span
                className={
                  c.key === "overall_index"
                    ? "font-display text-[1.063rem] font-bold text-ink"
                    : c.key === "vor"
                      ? Number(p.vor) < 0
                        ? "text-down"
                        : "text-up"
                      : "font-medium text-ink"
                }
              >
                {cell(p, c)}
              </span>
            ) : (
              cell(p, c)
            )}
          </td>
        );
      })}
      <td className="whitespace-nowrap border-b border-line px-5 py-3 text-right align-middle">
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
            className="text-[0.938rem] leading-none transition-transform hover:scale-110"
            style={{ color: p.is_marquee ? "var(--highlight)" : "var(--faint)" }}
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
            className="label-mono transition hover:text-red"
          >
            Restore
          </button>
        ) : p.sold ? (
          <span
            className="num rounded-full px-2 py-[3px] text-[0.594rem] uppercase tracking-[0.1em]"
            style={{ background: "var(--chip)", color: "var(--muted)" }}
          >
            Sold
          </span>
        ) : (
          <button
            onClick={() =>
              startTransition(async () => {
                await setRegStatus(p.id, "rejected");
              })
            }
            disabled={pending}
            className="label-mono transition hover:text-down"
          >
            Reject
          </button>
        )}
        </span>
      </td>
    </tr>
  );
}
