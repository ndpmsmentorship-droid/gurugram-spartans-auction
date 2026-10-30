"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayerPhoto } from "@/app/register/PlayerCard";
import type { PoolEntry, PoolStatus } from "@/lib/auction/owner-pool";

// Season 2 registrations as they come in, with the league's call on each:
// selected, under review or rejected. Refreshes every 30 s.
const TABS: { key: PoolStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "selected", label: "Selected" },
  { key: "review", label: "Under review" },
  { key: "rejected", label: "Rejected" },
];
const BADGE: Record<PoolStatus, string> = {
  selected: "bg-[color-mix(in_srgb,var(--up)_12%,transparent)] text-up",
  review: "bg-gold-fill text-gold",
  rejected: "bg-[color-mix(in_srgb,var(--red)_10%,transparent)] text-red-deep",
};
const LABEL: Record<PoolStatus, string> = { selected: "Selected", review: "Under review", rejected: "Rejected" };

export function usePool() {
  const [pool, setPool] = useState<PoolEntry[] | null>(null);
  const [at, setAt] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const r = await fetch("/spartansscout/api/owner-pool", { cache: "no-store" }).catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) : null;
      if (alive && j?.pool) {
        setPool(j.pool);
        setAt(j.at);
      }
    };
    pull();
    const id = setInterval(pull, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return { pool, at };
}

export default function LivePool() {
  const { pool, at } = usePool();
  const [tab, setTab] = useState<PoolStatus | "all">("all");
  const [q, setQ] = useState("");
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: pool?.length ?? 0, selected: 0, review: 0, rejected: 0 };
    for (const p of pool ?? []) c[p.status] += 1;
    return c;
  }, [pool]);
  const shown = (pool ?? []).filter(
    (p) => (tab === "all" || p.status === tab) && (!q.trim() || `${p.name} ${p.employer ?? ""} ${p.role}`.toLowerCase().includes(q.trim().toLowerCase())),
  );

  return (
    <section className="mx-auto w-full max-w-[760px]">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">Live pool · Season 2</p>
          <h2 className="mt-1 font-display text-2xl font-bold uppercase leading-tight">Players as they register</h2>
        </div>
        {at && <p className="text-[0.75rem] text-muted">Updated {new Date(at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1.5 text-sm ${tab === t.key ? "bg-ink text-white" : "border border-line text-muted"}`}
          >
            {t.label} <span className="num opacity-70">{counts[t.key]}</span>
          </button>
        ))}
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, company or role"
        className="mt-3 w-full rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-red"
      />

      {pool === null ? (
        <p className="mt-6 text-sm text-muted">Loading the pool…</p>
      ) : shown.length === 0 ? (
        <p className="mt-6 rounded-[12px] border border-line p-4 text-sm text-muted">
          {pool.length ? "No players match." : "No registrations yet. Registrations open on Mon 2 Nov 2026; players appear here the moment they sign up."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-[12px] border border-line bg-surface">
          {shown.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-3">
              <PlayerPhoto src={p.photo} name={p.name} className="h-11 w-11 shrink-0 rounded-full" sizes="44px" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {p.name}
                  <span className="ml-2 rounded-full border border-line px-1.5 py-0.5 text-[0.625rem] font-normal text-muted">{p.returning ? "Returning" : "New"}</span>
                </p>
                <p className="truncate text-[0.75rem] text-muted">{p.role}</p>
                {(p.designation || p.employer) && <p className="truncate text-[0.75rem] text-muted">{[p.designation, p.employer].filter(Boolean).join(", ")}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[0.688rem] ${BADGE[p.status]}`}>{LABEL[p.status]}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[0.688rem] text-muted">The league vets every registration. Contact details stay with the league office.</p>
    </section>
  );
}
