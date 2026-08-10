"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSquadSlot } from "./slot-actions";

export type SquadSlotPlayer = {
  id: string;
  full_name: string;
  primary_role: string | null;
  is_keeper: boolean | null;
  auction_category: string | null;
  acquired: string | null;
  sold_price: number | null;
  squad_slot: string | null;
};

// Manual position targets for the real Spartans auction squad.
const SLOTS: { key: string; label: string; target: number }[] = [
  { key: "bowler", label: "Bowlers", target: 7 },
  { key: "middle_order", label: "Middle-order", target: 4 },
];

const inr = (n: number | null) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

export default function PositionTargets({
  players,
  isAdmin,
}: {
  players: SquadSlotPlayer[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const countOf = (key: string) => players.filter((p) => p.squad_slot === key).length;

  function assign(id: string, slot: string | null) {
    start(async () => {
      const res = await setSquadSlot(id, slot);
      if (res?.error) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">Gurugram Spartans · auction squad</p>
          <h2 className="mt-1 font-display text-2xl font-bold">Position targets</h2>
        </div>
        <p className="text-sm text-muted tabular-nums">{players.length} in squad</p>
      </div>

      {/* target cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {SLOTS.map((s) => {
          const have = countOf(s.key);
          const pct = Math.min(100, (have / s.target) * 100);
          const full = have >= s.target;
          return (
            <div key={s.key} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{s.label}</span>
                <span className={`tabular-nums text-sm ${full ? "text-up font-semibold" : "text-muted"}`}>
                  {have} / {s.target}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wash">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: full ? "var(--up)" : "var(--accent)" }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* squad list with slot tagging */}
      <ul className="mt-4 divide-y divide-border/70 rounded-xl border border-border bg-surface">
        {players.length === 0 ? (
          <li className="p-4 text-center text-sm text-muted">
            No players on the Spartans squad yet — they appear here as you win them in the auction.
          </li>
        ) : (
          players.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span className="min-w-0 truncate">
                <span className="font-medium">{p.full_name}</span>
                {p.acquired === "retained" && <span className="ml-1.5 text-[10px] uppercase text-highlight-ink">R</span>}
                {p.acquired === "owner" && <span className="ml-1.5 text-[10px] uppercase text-accent-text">O</span>}
                <span className="ml-2 text-xs text-muted">
                  {[p.auction_category, p.primary_role].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums text-xs text-muted">{inr(p.sold_price)}</span>
                {isAdmin ? (
                  <span className="inline-flex overflow-hidden rounded-lg border border-border text-xs">
                    {SLOTS.map((s) => {
                      const on = p.squad_slot === s.key;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          disabled={pending}
                          onClick={() => assign(p.id, on ? null : s.key)}
                          className={`px-2.5 py-1 transition disabled:opacity-60 ${
                            on ? "bg-accent font-semibold text-white" : "hover:bg-wash"
                          }`}
                          title={on ? `Clear ${s.label}` : `Tag as ${s.label}`}
                        >
                          {s.key === "bowler" ? "Bowl" : "Mid"}
                        </button>
                      );
                    })}
                  </span>
                ) : (
                  p.squad_slot && (
                    <span className="rounded-full bg-wash px-2 py-0.5 text-xs text-muted">
                      {p.squad_slot === "bowler" ? "Bowler" : "Middle-order"}
                    </span>
                  )
                )}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
