"use client";

import { useMemo, useState } from "react";
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
};

const rankId = (r: number | null) => (r == null ? "—" : "#" + String(r).padStart(3, "0"));

export default function TargetsList({ players }: { players: PoolPlayer[] }) {
  const [q, setQ] = useState("");
  const [onlyMarked, setOnlyMarked] = useState(false);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return players.filter((p) => {
      if (onlyMarked && !p.marked) return false;
      if (s && !p.full_name.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [players, q, onlyMarked]);

  const markedCount = players.filter((p) => p.marked).length;

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

      <ul className="mt-4 divide-y divide-line rounded-[12px] border border-line bg-surface">
        {shown.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="num w-10 shrink-0 text-[0.7rem] font-semibold text-red">
              {rankId(p.overall_rank)}
            </span>
            <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-line bg-wash">
              {p.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {p.full_name}
                {p.sold && <span className="ml-1.5 text-[0.6rem] uppercase text-muted">sold</span>}
              </span>
              <span className="num block truncate text-[0.7rem] text-muted">
                {[p.auction_category, p.primary_role].filter(Boolean).join(" · ")}
              </span>
            </span>
            <MarkButton playerId={p.id} marked={p.marked} />
          </li>
        ))}
        {shown.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-muted">No players match.</li>
        )}
      </ul>
    </div>
  );
}
