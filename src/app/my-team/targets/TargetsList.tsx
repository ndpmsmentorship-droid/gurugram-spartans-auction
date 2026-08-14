"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import MarkButton from "../MarkButton";

export type PoolPlayer = {
  id: string;
  full_name: string;
  auction_category: string | null;
  primary_role: string | null;
  overall_rank: number | null;
  photo_url: string | null;
  sold: boolean;
  marked: boolean;
  bat_avg: number | null;
  bat_sr: number | null;
  economy: number | null;
  wickets: number | null;
  stumpings: number | null;
};

const rankId = (r: number | null) => (r == null ? "—" : "#" + String(r).padStart(3, "0"));
const n1 = (v: number | null) => (v == null ? "—" : Math.round(v * 10) / 10);
const int = (v: number | null) => (v == null ? "—" : Math.round(v).toLocaleString("en-IN"));

type SortKey = "name" | "rank" | "bat_avg" | "bat_sr" | "economy" | "wickets" | "stumpings";

// For each sortable stat: how to read it and which direction is "best" so the
// first click surfaces the strongest players (economy: lower is better).
const COLUMNS: {
  key: SortKey;
  label: string;
  get: (p: PoolPlayer) => number | null;
  bestHigh: boolean;
}[] = [
  { key: "rank", label: "Rank", get: (p) => p.overall_rank, bestHigh: false },
  { key: "bat_avg", label: "Bat Avg", get: (p) => p.bat_avg, bestHigh: true },
  { key: "bat_sr", label: "Bat SR", get: (p) => p.bat_sr, bestHigh: true },
  { key: "economy", label: "Economy", get: (p) => p.economy, bestHigh: false },
  { key: "wickets", label: "Wkts", get: (p) => p.wickets, bestHigh: true },
  { key: "stumpings", label: "Stmp", get: (p) => p.stumpings, bestHigh: true },
];

// The SCCL auction categories, in board order. "All" is prepended at render.
const GROUPS = ["U35A", "U35B", "35+A", "35+B", "Legend"] as const;
type Group = (typeof GROUPS)[number] | "All";

export default function TargetsList({ players }: { players: PoolPlayer[] }) {
  const [q, setQ] = useState("");
  const [onlyMarked, setOnlyMarked] = useState(false);
  const [group, setGroup] = useState<Group>("All");
  const [sort, setSort] = useState<SortKey>("rank");
  const [asc, setAsc] = useState(false); // false = best-first for the active column

  // A numeric column when one is active; undefined while sorting by name.
  const col = COLUMNS.find((c) => c.key === sort);

  const groupCounts = useMemo(() => {
    const c: Record<string, number> = { All: players.length };
    GROUPS.forEach((g) => (c[g] = 0));
    players.forEach((p) => {
      const cat = (p.auction_category || "").trim();
      if (cat in c) c[cat] += 1;
    });
    return c;
  }, [players]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = players.filter((p) => {
      if (group !== "All" && (p.auction_category || "").trim() !== group) return false;
      if (onlyMarked && !p.marked) return false;
      if (s && !p.full_name.toLowerCase().includes(s)) return false;
      return true;
    });
    // Alphabetical when the Player column is active (asc = A→Z).
    if (!col) {
      return filtered.sort((a, b) =>
        asc
          ? a.full_name.localeCompare(b.full_name)
          : b.full_name.localeCompare(a.full_name)
      );
    }
    // "best first" means: high-is-good columns descend, low-is-good ascend.
    // `asc` flips that. Nulls always sink to the bottom.
    const bestFirst = col.bestHigh ? !asc : asc;
    return filtered.sort((a, b) => {
      const va = col.get(a);
      const vb = col.get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return bestFirst ? vb - va : va - vb;
    });
  }, [players, q, onlyMarked, group, col, asc]);

  const markedCount = players.filter((p) => p.marked).length;

  const clickSort = (k: SortKey) => {
    if (k === sort) setAsc((v) => !v);
    else {
      setSort(k);
      // Name defaults A→Z; numeric columns default best-first.
      setAsc(k === "name");
    }
  };

  const arrow = (k: SortKey) => {
    if (k !== sort) return "";
    if (k === "name") return asc ? " ↓" : " ↑"; // A→Z shows ↓
    const c = COLUMNS.find((x) => x.key === k)!;
    const bestFirst = c.bestHigh ? !asc : asc;
    // show the direction of the values, not of "best"
    return bestFirst === c.bestHigh ? " ↓" : " ↑";
  };

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs py-2"
          placeholder="Search players…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setOnlyMarked((v) => !v)}
          data-active={onlyMarked}
          className="pill"
        >
          ★ Marked {markedCount}
        </button>
        <span className="ml-auto label-mono">{shown.length} shown</span>
      </div>

      {/* category groups */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["All", ...GROUPS] as Group[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            data-active={group === g}
            className={`rounded-full border px-3 py-1 text-[0.78rem] font-medium transition ${
              group === g
                ? "border-red bg-[color-mix(in_oklab,var(--red)_14%,transparent)] text-red"
                : "border-line text-muted hover:border-red hover:text-red"
            }`}
          >
            {g}
            <span className="num ml-1.5 opacity-70">{groupCounts[g] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-[12px] border border-line">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[0.875rem]">
          <thead>
            <tr>
              <th
                className="label-mono cursor-pointer select-none border-b border-line px-3 py-3 text-left hover:text-red"
                style={{ background: "var(--wash)" }}
                onClick={() => clickSort("name")}
                aria-sort={sort === "name" ? (asc ? "ascending" : "descending") : "none"}
              >
                Player
                <span className="text-red">{arrow("name")}</span>
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="label-mono cursor-pointer select-none border-b border-line px-3 py-3 text-right hover:text-red"
                  style={{ background: "var(--wash)" }}
                  onClick={() => clickSort(c.key)}
                  aria-sort={sort === c.key ? (asc ? "ascending" : "descending") : "none"}
                >
                  {c.label}
                  <span className="text-red">{arrow(c.key)}</span>
                </th>
              ))}
              <Th right>Mark</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p, i) => (
              <tr key={p.id} style={{ background: i % 2 ? "var(--zebra, transparent)" : "var(--surface)" }}>
                <td className="border-b border-line px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="num w-9 shrink-0 text-[0.7rem] font-semibold text-red">
                      {rankId(p.overall_rank)}
                    </span>
                    <span className="min-w-0">
                      <Link
                        href={`/players/${p.id}?from=targets`}
                        className="block truncate font-medium text-ink transition hover:text-red hover:underline"
                      >
                        {p.full_name}
                        {p.sold && <span className="ml-1.5 text-[0.6rem] uppercase text-muted">sold</span>}
                      </Link>
                      <span className="num block truncate text-[0.7rem] text-muted">
                        {[p.auction_category, p.primary_role].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </div>
                </td>
                <Td active={sort === "rank"}>{p.overall_rank == null ? "—" : "#" + p.overall_rank}</Td>
                <Td active={sort === "bat_avg"}>{n1(p.bat_avg)}</Td>
                <Td active={sort === "bat_sr"}>{n1(p.bat_sr)}</Td>
                <Td active={sort === "economy"}>{n1(p.economy)}</Td>
                <Td active={sort === "wickets"}>{int(p.wickets)}</Td>
                <Td active={sort === "stumpings"}>{int(p.stumpings)}</Td>
                <td className="border-b border-line px-3 py-2.5 text-right">
                  <MarkButton playerId={p.id} marked={p.marked} />
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted">
                  No players match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`label-mono border-b border-line px-3 py-3 ${right ? "text-right" : "text-left"}`}
      style={{ background: "var(--wash)" }}
    >
      {children}
    </th>
  );
}

function Td({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <td
      className={`num border-b border-line px-3 py-2.5 text-right ${
        active ? "font-semibold text-ink" : "text-muted"
      }`}
    >
      {children}
    </td>
  );
}
