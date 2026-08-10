"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// Typeahead to jump straight to any player's analysis page.
export default function PlayerSearch({ players }: { players: { id: string; full_name: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return players.filter((p) => p.full_name.toLowerCase().includes(s)).slice(0, 8);
  }, [q, players]);

  return (
    <div className="relative w-full sm:w-72">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Search a player…"
        className="input w-full"
        aria-label="Search players"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface shadow-lg">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={() => { router.push(`/scout/${p.id}`); setQ(""); setOpen(false); }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-wash"
              >
                {p.full_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
