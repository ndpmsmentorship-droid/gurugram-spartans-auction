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
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 font-mono text-[0.688rem] uppercase tracking-[0.06em] transition disabled:opacity-50"
      style={{
        borderColor: on ? "var(--gold-line)" : "var(--line2)",
        color: on ? "var(--gold)" : "var(--muted)",
        background: on ? "var(--gold-fill)" : "transparent",
      }}
    >
      <span className="text-[0.875rem] leading-none">{on ? "★" : "☆"}</span>
      {on ? "Marquee — must buy" : "Mark marquee"}
    </button>
  );
}
