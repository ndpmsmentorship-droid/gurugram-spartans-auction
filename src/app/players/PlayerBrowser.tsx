"use client";

import { useMemo, useState } from "react";
import type { PlayerStatus } from "@/lib/supabase/types";

type Row = {
  id: string;
  category: string | null;
  base_price: number;
  status: PlayerStatus;
  batting_avg: number | null;
  batting_sr: number | null;
  wickets: number | null;
  economy: number | null;
  players: {
    full_name: string;
    primary_role: string | null;
    batting_style: string | null;
    bowling_style: string | null;
  } | null;
};

const STATUS_STYLES: Record<PlayerStatus, string> = {
  registered: "bg-background text-muted",
  shortlisted: "bg-accent/20 text-accent",
  in_pool: "bg-primary/15 text-primary",
  sold: "bg-success/15 text-success",
  unsold: "bg-danger/15 text-danger",
};

export default function PlayerBrowser({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        (r.players?.full_name ?? "").toLowerCase().includes(query.toLowerCase())
      ),
    [rows, query]
  );

  return (
    <div className="mt-4">
      <input
        className="input mb-3 max-w-xs"
        placeholder="Search by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between">
              <p className="font-medium">{r.players?.full_name}</p>
              <span className={`badge ${STATUS_STYLES[r.status]}`}>
                {r.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-sm text-muted">
              {r.players?.primary_role ?? "—"}
              {r.category ? ` · Category ${r.category}` : ""}
            </p>
            <p className="mt-2 text-xs text-muted">
              Bat avg {r.batting_avg ?? "—"} · SR {r.batting_sr ?? "—"} · Wkts{" "}
              {r.wickets ?? "—"} · Econ {r.economy ?? "—"}
            </p>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="mt-6 text-center text-muted">No players match.</p>
      )}
    </div>
  );
}
