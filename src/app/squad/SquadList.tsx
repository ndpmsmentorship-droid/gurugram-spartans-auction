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
    <div className="mt-6 space-y-2">
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
    <div className="card flex flex-wrap items-center gap-3 py-3">
      <input
        type="number"
        className="input w-14 text-center"
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
        <p className="truncate font-display font-semibold">{player.full_name}</p>
        <p className="text-xs text-muted">{player.primary_role ?? "—"}</p>
      </div>

      <select
        className="input max-w-[13rem]"
        value={UTILITY_OPTIONS.includes(tag) ? tag : ""}
        onChange={(e) => {
          const val = e.target.value;
          setTag(val);
          startTransition(async () => {
            await setUtilityTag(player.id, val);
          });
        }}
      >
        <option value="">{tag || "Set utility…"}</option>
        {UTILITY_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      <span className="badge bg-wash text-accent-text">
        {player.bought_price?.toLocaleString()}
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
        Remove
      </button>
    </div>
  );
}
