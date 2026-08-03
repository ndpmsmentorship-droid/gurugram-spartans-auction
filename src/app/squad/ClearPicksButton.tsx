"use client";

import { useTransition } from "react";
import { clearAllBought } from "@/app/scout/actions";

// Resets the pseudo squad: clears every mock buy in one click.
export default function ClearPicksButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("Clear all mock buys from the pseudo squad?")) return;
        startTransition(async () => {
          const res = await clearAllBought();
          if (res?.error) alert(`Couldn't clear picks: ${res.error}`);
        });
      }}
      disabled={pending}
      className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted transition hover:text-down disabled:opacity-50"
    >
      {pending ? "Clearing…" : "Clear all picks"}
    </button>
  );
}
