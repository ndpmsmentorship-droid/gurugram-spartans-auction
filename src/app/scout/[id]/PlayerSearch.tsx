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
        className="input with-icon w-full"
        aria-label="Search players"
      />
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[0.875rem] text-faint">
        ⌕
      </span>
      {open && matches.length > 0 && (
        <ul
          className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-[12px] border border-line bg-surface py-1"
          style={{ boxShadow: "var(--elev)" }}
        >
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={() => { router.push(`/scout/${p.id}`); setQ(""); setOpen(false); }}
                className="block w-full px-4 py-2 text-left text-[0.875rem] transition hover:bg-wash hover:text-red"
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
