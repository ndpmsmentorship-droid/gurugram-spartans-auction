"use client";

import { useMemo, useState, useTransition } from "react";
import { updatePlayerAuctionInfo } from "./actions";
import type { PlayerStatus } from "@/lib/supabase/types";

type Row = {
  id: string;
  player_id: string;
  category: string | null;
  base_price: number;
  min_price: number;
  status: PlayerStatus;
  players: {
    full_name: string;
    primary_role: string | null;
    batting_style: string | null;
    bowling_style: string | null;
  } | null;
};

const STATUSES: PlayerStatus[] = [
  "registered",
  "shortlisted",
  "in_pool",
  "sold",
  "unsold",
];

export default function PlayersTable({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PlayerStatus | "all">("all");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchesQuery = (r.players?.full_name ?? "")
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [rows, query, statusFilter]);

  return (
    <div className="mt-4">
      <div className="mb-3 flex gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input max-w-[10rem]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PlayerStatus | "all")}
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Base price</th>
              <th className="px-3 py-2">Min price</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <PlayerRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-4 text-center text-muted">No players match.</p>
        )}
      </div>
    </div>
  );
}

function PlayerRow({ row }: { row: Row }) {
  const [category, setCategory] = useState(row.category ?? "");
  const [basePrice, setBasePrice] = useState(row.base_price);
  const [minPrice, setMinPrice] = useState(row.min_price);
  const [status, setStatus] = useState(row.status);
  const [pending, startTransition] = useTransition();

  function save(updates: Parameters<typeof updatePlayerAuctionInfo>[1]) {
    startTransition(async () => {
      await updatePlayerAuctionInfo(row.id, updates);
    });
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-medium">{row.players?.full_name}</td>
      <td className="px-3 py-2 text-muted">{row.players?.primary_role ?? "—"}</td>
      <td className="px-3 py-2">
        <input
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onBlur={() => save({ category: category || null })}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          className="input w-24"
          value={basePrice}
          onChange={(e) => setBasePrice(Number(e.target.value))}
          onBlur={() => save({ base_price: basePrice })}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          className="input w-24"
          value={minPrice}
          onChange={(e) => setMinPrice(Number(e.target.value))}
          onBlur={() => save({ min_price: minPrice })}
        />
      </td>
      <td className="px-3 py-2">
        <select
          className="input"
          value={status}
          onChange={(e) => {
            const next = e.target.value as PlayerStatus;
            setStatus(next);
            save({ status: next });
          }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {pending && <span className="ml-2 text-xs text-muted">saving…</span>}
      </td>
    </tr>
  );
}
