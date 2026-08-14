"use client";

import { useState, useTransition } from "react";
import { toggleMark } from "./mark-actions";

export default function MarkButton({
  playerId,
  marked: initial,
}: {
  playerId: string;
  marked: boolean;
}) {
  const [marked, setMarked] = useState(initial);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <button
      type="button"
      disabled={pending}
      title={err ?? (marked ? "Marked — click to remove" : "Mark as a target")}
      onClick={() => {
        setErr(null);
        const next = !marked;
        setMarked(next); // optimistic
        start(async () => {
          const r = await toggleMark(playerId);
          if (r.error) {
            setMarked(!next);
            setErr(r.error);
          } else if (typeof r.marked === "boolean") {
            setMarked(r.marked);
          }
        });
      }}
      className={`shrink-0 rounded-full border px-3 py-1 text-[0.75rem] font-semibold transition disabled:opacity-50 ${
        marked
          ? "border-red bg-[color-mix(in_oklab,var(--red)_14%,transparent)] text-red"
          : "border-line text-muted hover:border-red hover:text-red"
      }`}
    >
      {marked ? "★ Marked" : "☆ Mark"}
    </button>
  );
}
