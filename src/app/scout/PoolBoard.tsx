"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { RankedPlayer } from "@/lib/scout/ranks";
import type { RiskFlag } from "@/lib/scout/analytics";
import { markBought, unmarkBought } from "./actions";
import IndexBars from "./IndexBars";

export type PoolPlayer = RankedPlayer<{
  id: string;
  full_name: string;
  primary_role: string | null;
  is_keeper: boolean;
  is_bought: boolean;
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
  fit_score: number;
};

type SortKey =
  | "fit_score"
  | "overall_rank"
  | "vor"
  | "bat_rank"
  | "bowl_rank"
  | "field_rank"
  | "bat_sr"
  | "wickets"
  | "economy";

const SORTS: { key: SortKey; label: string; asc: boolean }[] = [
  { key: "fit_score", label: "Best fit for my squad", asc: false },
  { key: "overall_rank", label: "Overall rank", asc: true },
  { key: "vor", label: "Value over replacement", asc: false },
  { key: "bat_rank", label: "Batting rank", asc: true },
  { key: "bowl_rank", label: "Bowling rank", asc: true },
  { key: "field_rank", label: "Fielding rank", asc: true },
  { key: "bat_sr", label: "Strike rate", asc: false },
  { key: "wickets", label: "Wickets", asc: false },
  { key: "economy", label: "Economy", asc: true },
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

export default function PoolBoard({ players }: { players: PoolPlayer[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("fit_score");
  const [role, setRole] = useState("All");
  const [avail, setAvail] = useState<"all" | "available" | "bought">("available");

  const filtered = useMemo(() => {
    const sortDef = SORTS.find((s) => s.key === sort)!;
    return players
      .filter((p) => {
        if (query && !p.full_name.toLowerCase().includes(query.toLowerCase()))
          return false;
        if (role !== "All" && roleGroup(p.primary_role, p.is_keeper) !== role)
          return false;
        if (avail === "available" && p.is_bought) return false;
        if (avail === "bought" && !p.is_bought) return false;
        return true;
      })
      .sort((a, b) => {
        const av = (a[sort] ?? (sortDef.asc ? 1e9 : -1e9)) as number;
        const bv = (b[sort] ?? (sortDef.asc ? 1e9 : -1e9)) as number;
        return sortDef.asc ? av - bv : bv - av;
      });
  }, [players, query, sort, role, avail]);

  return (
    <div className="mt-5">
      <div className="sticky top-[57px] z-10 -mx-5 mb-4 flex flex-wrap gap-2 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <input
          className="input max-w-[12rem]"
          placeholder="Search player…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input max-w-[15rem]"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
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
          <option value="all">All</option>
        </select>
      </div>

      <p className="mb-3 text-xs text-muted">{filtered.length} shown</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <PlayerCard key={p.id} player={p} showFit={sort === "fit_score"} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="mt-8 text-center text-muted">No players match.</p>
      )}
    </div>
  );
}

function PlayerCard({ player, showFit }: { player: PoolPlayer; showFit: boolean }) {
  const [buying, setBuying] = useState(false);
  const [price, setPrice] = useState("");
  const [pending, startTransition] = useTransition();

  function confirmBuy() {
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return;
    startTransition(async () => {
      await markBought(player.id, p);
      setBuying(false);
      setPrice("");
    });
  }

  return (
    <div className={`card ${player.is_bought ? "border-accent/50 bg-wash" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/scout/${player.id}`} className="min-w-0 hover:text-accent-text">
          <p className="truncate font-display font-semibold">{player.full_name}</p>
          <p className="text-xs text-muted">{player.archetype}</p>
        </Link>
        <div className="shrink-0 text-right">
          <span className="badge bg-ink text-[var(--surface)]">
            #{player.overall_rank}
          </span>
          <p className="mt-0.5 font-mono text-[10px] text-muted">
            {showFit
              ? `fit ${Math.round(player.fit_score)}`
              : `VOR ${player.vor >= 0 ? "+" : ""}${player.vor}`}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <IndexBars
          bat={player.bat_index}
          bowl={player.bowl_index}
          field={player.field_index}
          keep={player.keep_index}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span>Avg {player.bat_avg ?? "—"}</span>
        <span>SR {player.bat_sr ?? "—"}</span>
        <span>Wkts {player.wickets ?? "—"}</span>
        <span>Econ {player.economy ?? "—"}</span>
        {player.topRisk && (
          <span
            className={`badge ${
              player.topRisk.level === "red"
                ? "bg-down/15 text-down"
                : "bg-accent/20 text-accent-text"
            }`}
          >
            {player.topRisk.label}
          </span>
        )}
      </div>

      <div className="mt-4">
        {player.is_bought ? (
          <div className="flex items-center justify-between">
            <span className="badge bg-accent text-ink">
              Bought · {player.bought_price?.toLocaleString()}
            </span>
            <button
              onClick={() =>
                startTransition(async () => {
                  await unmarkBought(player.id);
                })
              }
              disabled={pending}
              className="text-xs text-muted hover:text-down"
            >
              Undo
            </button>
          </div>
        ) : buying ? (
          <div className="flex gap-2">
            <input
              type="number"
              autoFocus
              className="input w-24"
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmBuy()}
            />
            <button onClick={confirmBuy} disabled={pending} className="btn-primary">
              Buy
            </button>
            <button onClick={() => setBuying(false)} className="btn-ghost">
              ✕
            </button>
          </div>
        ) : (
          <button onClick={() => setBuying(true)} className="btn-ghost w-full">
            Mark bought
          </button>
        )}
      </div>
    </div>
  );
}
