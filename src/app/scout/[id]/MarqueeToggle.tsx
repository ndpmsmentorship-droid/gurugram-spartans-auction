"use client";

import { useState, useTransition } from "react";
import { setMarquee } from "@/app/scout/actions";

// Same "must buy" star as the pool list, for the player infographic page.
export default function MarqueeToggle({
  id,
  initial,
}: {
  id: string;
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          const next = !on;
          setOn(next); // optimistic
          const res = await setMarquee(id, next);
          if (res.error) {
            setOn(!next);
            alert(
              `Couldn't mark marquee: ${res.error}\n\nIf this mentions "is_marquee", run supabase/scout_category.sql in Supabase first.`
            );
          }
        })
      }
      disabled={pending}
      title={on ? "Unmark marquee" : "Mark as marquee (must buy)"}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition hover:scale-[1.03] disabled:opacity-50"
      style={{
        borderColor: on ? "#E3A81B" : "var(--border)",
        color: on ? "#B4820F" : "var(--muted)",
        background: on ? "color-mix(in srgb, #E3A81B 14%, transparent)" : "transparent",
      }}
    >
      <span className="text-base leading-none">{on ? "★" : "☆"}</span>
      {on ? "Marquee — must buy" : "Mark for auction"}
    </button>
  );
}
