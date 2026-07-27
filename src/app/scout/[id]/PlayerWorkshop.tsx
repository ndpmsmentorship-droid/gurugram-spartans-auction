"use client";

import { useState } from "react";
import type { ScoutPlayerRow } from "@/lib/supabase/types";
import StatsEditor from "./StatsEditor";
import ClipEditor from "./ClipEditor";

type Tab = "manual" | "clip";

export default function PlayerWorkshop({ player }: { player: ScoutPlayerRow }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("manual");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost mt-6">
        Update this player&apos;s data
      </button>
    );
  }

  return (
    <section className="card mt-6">
      <div className="mb-4 flex flex-wrap gap-1 rounded-full bg-background p-1 text-sm">
        {(
          [
            ["manual", "Edit stats"],
            ["clip", "Scouting clip"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 transition ${
              tab === key ? "bg-surface font-medium shadow-sm" : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setOpen(false)}
          className="ml-auto px-3 text-muted hover:text-down"
        >
          Close
        </button>
      </div>

      {tab === "manual" && <StatsEditor player={player} onSaved={() => {}} />}

      {tab === "clip" && (
        <ClipEditor
          playerId={player.id}
          clipUrl={player.scouting_clip_url}
          note={player.scouting_note}
        />
      )}
    </section>
  );
}
