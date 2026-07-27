"use client";

import { useState, useTransition } from "react";
import { setBattingOrder, setUtilityTag, unmarkBought } from "@/app/scout/actions";

export type SquadPlayer = {
  id: string;
  full_name: string;
  primary_role: string | null;
  is_keeper: boolean;
  bought_price: number | null;
  utility_tag: string | null;
  suggested_batting_order: number | null;
  bat_index: number | null;
  bowl_index: number | null;
  field_index: number | null;
  keep_index: number | null;
};

const UTILITY_OPTIONS = [
  "Aggressive top-order",
  "Top-order anchor",
  "Middle-order / utility",
  "All-rounder",
  "Frontline bowler",
  "Death-overs bowler",
  "Wicketkeeper",
];

export default function SquadList({ players }: { players: SquadPlayer[] }) {
  return (
    <div className="mt-6 overflow-hidden rounded-[18px] border border-border">
      {players.map((p) => (
        <SquadRow key={p.id} player={p} />
      ))}
    </div>
  );
}

function SquadRow({ player }: { player: SquadPlayer }) {
  const [order, setOrder] = useState(
    player.suggested_batting_order != null
      ? String(player.suggested_batting_order)
      : ""
  );
  const [tag, setTag] = useState(player.utility_tag ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-3 py-2 last:border-b-0">
      <input
        type="number"
        className="w-9 shrink-0 rounded-md bg-wash py-1 text-center text-sm tabular-nums outline-none focus:ring-2 focus:ring-accent/40"
        value={order}
        onChange={(e) => setOrder(e.target.value)}
        onBlur={() =>
          startTransition(async () => {
            await setBattingOrder(
              player.id,
              order.trim() === "" ? null : Number(order)
            );
          })
        }
        aria-label="Batting order"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">
          {player.full_name}
        </p>
        <p className="truncate text-xs text-muted">
          {tag || player.primary_role || "—"}
        </p>
      </div>

      <select
        className="hidden max-w-[12rem] rounded-md bg-wash px-2 py-1 text-xs text-muted outline-none focus:ring-2 focus:ring-accent/40 sm:block"
        value={UTILITY_OPTIONS.includes(tag) ? tag : ""}
        onChange={(e) => {
          const val = e.target.value;
          setTag(val);
          startTransition(async () => {
            await setUtilityTag(player.id, val);
          });
        }}
      >
        <option value="">Set utility…</option>
        {UTILITY_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      <span className="shrink-0 text-sm font-medium tabular-nums text-accent-text">
        {player.bought_price?.toLocaleString()}
      </span>
      <button
        onClick={() =>
          startTransition(async () => {
            await unmarkBought(player.id);
          })
        }
        disabled={pending}
        className="shrink-0 text-xs text-muted transition hover:text-down"
        aria-label={`Remove ${player.full_name}`}
      >
        ✕
      </button>
    </div>
  );
}
