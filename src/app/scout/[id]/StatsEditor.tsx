"use client";

import { useState, useTransition } from "react";
import { updatePlayerStats, type StatPatch } from "@/app/scout/actions";
import type { ScoutPlayerRow } from "@/lib/supabase/types";

type NumField = Exclude<keyof StatPatch, "primary_role" | "is_keeper">;

const GROUPS: { title: string; fields: { key: NumField; label: string }[] }[] = [
  {
    title: "Batting",
    fields: [
      { key: "bat_matches", label: "Matches" },
      { key: "bat_innings", label: "Innings" },
      { key: "not_out", label: "Not out" },
      { key: "runs", label: "Runs" },
      { key: "bat_avg", label: "Average" },
      { key: "bat_sr", label: "Strike rate" },
      { key: "fifties", label: "50s" },
      { key: "hundreds", label: "100s" },
      { key: "fours", label: "4s" },
      { key: "sixes", label: "6s" },
      { key: "ducks", label: "Ducks" },
    ],
  },
  {
    title: "Bowling",
    fields: [
      { key: "bowl_matches", label: "Matches" },
      { key: "overs", label: "Overs" },
      { key: "wickets", label: "Wickets" },
      { key: "economy", label: "Economy" },
      { key: "bowl_avg", label: "Average" },
      { key: "bowl_sr", label: "Strike rate" },
      { key: "dot_balls", label: "Dot balls" },
      { key: "five_w", label: "5-wkt hauls" },
    ],
  },
  {
    title: "Fielding & keeping",
    fields: [
      { key: "catches", label: "Catches" },
      { key: "run_outs", label: "Run-outs" },
      { key: "stumpings", label: "Stumpings" },
      { key: "keeping_catches", label: "Keeper catches" },
    ],
  },
];

export default function StatsEditor({
  player,
  prefill,
  onSaved,
}: {
  player: ScoutPlayerRow;
  prefill?: StatPatch | null;
  onSaved?: () => void;
}) {
  const seed: Record<string, string> = {};
  for (const g of GROUPS)
    for (const f of g.fields) {
      const fromPrefill = prefill?.[f.key];
      const val = fromPrefill != null ? fromPrefill : player[f.key as keyof ScoutPlayerRow];
      seed[f.key] = val == null ? "" : String(val);
    }

  const [values, setValues] = useState<Record<string, string>>(seed);
  const [role, setRole] = useState(prefill?.primary_role ?? player.primary_role ?? "");
  const [isKeeper, setIsKeeper] = useState(prefill?.is_keeper ?? player.is_keeper);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const patch: StatPatch = { primary_role: role || null, is_keeper: isKeeper };
    for (const g of GROUPS)
      for (const f of g.fields) {
        const raw = values[f.key]?.trim();
        (patch[f.key] as number | null) =
          raw === "" || raw == null ? null : Number(raw);
      }
    setMsg(null);
    startTransition(async () => {
      const res = await updatePlayerStats(player.id, patch);
      setMsg(res.error ? res.error : "Saved & re-ranked.");
      if (!res.error) onSaved?.();
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Role</span>
          <input
            className="input w-48"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Batsman / Bowler / All Rounder"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={isKeeper}
            onChange={(e) => setIsKeeper(e.target.checked)}
          />
          Wicketkeeper
        </label>
      </div>

      {GROUPS.map((g) => (
        <div key={g.title} className="mb-4">
          <p className="eyebrow mb-2">{g.title}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {g.fields.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-[11px] text-muted">{f.label}</span>
                <input
                  type="number"
                  step="any"
                  className="input"
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save & re-rank"}
        </button>
        {msg && (
          <span className={msg.includes("Saved") ? "text-sm text-up" : "text-sm text-down"}>
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
