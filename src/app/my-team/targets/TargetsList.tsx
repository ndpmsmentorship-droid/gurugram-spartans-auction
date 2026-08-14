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
  stumpings: number | null;
};

const rankId = (r: number | null) => (r == null ? "—" : "#" + String(r).padStart(3, "0"));
const n1 = (v: number | null) => (v == null ? "—" : Math.round(v * 10) / 10);
const int = (v: number | null) => (v == null ? "—" : Math.round(v));

type SortKey = "rank" | "bat_avg" | "bat_sr" | "economy" | "stumpings";

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
  { key: "stumpings", label: "Stmp", get: (p) => p.stumpings, bestHigh: true },
];

export default function TargetsList({ players }: { players: PoolPlayer[] }) {
  const [q, setQ] = useState("");
  const [onlyMarked, setOnlyMarked] = useState(false);
  const [sort, setSort] = useState<SortKey>("rank");
  const [asc, setAsc] = useState(false); // false = best-first for the active column

  const col = COLUMNS.find((c) => c.key === sort)!;

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = players.filter((p) => {
      if (onlyMarked && !p.marked) return false;
      if (s && !p.full_name.toLowerCase().includes(s)) return false;
      return true;
    });
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
  }, [players, q, onlyMarked, col, asc]);

  const markedCount = players.filter((p) => p.marked).length;

  const clickSort = (k: SortKey) => {
    if (k === sort) setAsc((v) => !v);
    else {
      setSort(k);
      setAsc(false);
    }
  };

  const arrow = (k: SortKey) => {
    if (k !== sort) return "";
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

      <div className="mt-4 overflow-x-auto rounded-[12px] border border-line">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[0.875rem]">
          <thead>
            <tr>
              <Th>Player</Th>
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
                    <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-line bg-wash">
                      {p.photo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <Link
                        href={`/scout/${p.id}`}
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
                <Td active={sort === "stumpings"}>{int(p.stumpings)}</Td>
                <td className="border-b border-line px-3 py-2.5 text-right">
                  <MarkButton playerId={p.id} marked={p.marked} />
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted">
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
