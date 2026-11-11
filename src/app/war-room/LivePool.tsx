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

const fmt = (n: number | null, d = 0) => (n == null ? "–" : n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }));

// Instagram-style verified mark, in league red: the numbers were checked on CricHeroes by the league team.
function Checked({ on }: { on: string }) {
  const d = new Date(on).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <span className="inline-flex items-center gap-1 text-[0.625rem] text-muted" title="CricHeroes stats checked and entered by the league team">
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
        <path fill="var(--red)" d="M12 1.5l2.4 1.8 3-.2 1 2.8 2.6 1.6-.6 2.9 1.4 2.6-2 2.2-.2 3-2.9.7-1.8 2.4-2.9-.9-2.9.9-1.8-2.4-2.9-.7-.2-3-2-2.2 1.4-2.6-.6-2.9 2.6-1.6 1-2.8 3 .2z" />
        <path fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M7.5 12.3l3 3 6-6.3" />
      </svg>
      CricHeroes · {d}
    </span>
  );
}

function StatLine({ s, checkedOn }: { s: NonNullable<PoolEntry["stats"]>; checkedOn: string | null }) {
  const cells: [string, string][] = [
    ["Mat", fmt(s.m)],
    ["Runs", fmt(s.runs)],
    ["Avg", fmt(s.avg, 1)],
    ["SR", fmt(s.sr, 1)],
    ["HS", s.hs ?? "–"],
    ["Wkts", fmt(s.wk)],
    ["Econ", fmt(s.econ, 2)],
    ["Best", s.best ?? "–"],
  ];
  return (
    <div className="mt-1.5">
      <dl className="flex flex-wrap gap-1">
        {cells.map(([k, v]) => (
          <div key={k} className="flex flex-col-reverse rounded-[6px] border border-line px-1.5 py-0.5 text-center leading-tight">
            <dt className="text-[0.563rem] uppercase tracking-wide text-muted">{k}</dt>
            <dd className="num text-[0.75rem] font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {checkedOn && <div className="mt-1"><Checked on={checkedOn} /></div>}
    </div>
  );
}

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
            <li key={p.id} className="flex items-start gap-3 p-3">
              <PlayerPhoto src={p.photo} name={p.name} className="h-11 w-11 shrink-0 rounded-full" sizes="44px" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold">
                  {p.name}
                  <span className="rounded-full border border-line px-1.5 py-0.5 text-[0.625rem] font-normal text-muted">{p.returning ? "Returning" : "New"}</span>
                </p>
                <p className="text-[0.75rem] leading-snug text-muted">
                  {p.role}
                  {p.lastTeam ? ` · S1 ${p.lastTeam}` : ""}
                  {!p.hasData && <span className="ml-1.5 rounded-full bg-gold-fill px-1.5 py-0.5 text-[0.625rem] text-gold">No data yet</span>}
                </p>
                {(p.designation || p.employer) && <p className="text-[0.75rem] leading-snug text-muted">{[p.designation, p.employer].filter(Boolean).join(", ")}</p>}
                {p.stats && <StatLine s={p.stats} checkedOn={p.checkedOn} />}
              </div>
              <span className={`mt-0.5 shrink-0 rounded-full px-2 py-1 text-[0.688rem] ${BADGE[p.status]}`}>{LABEL[p.status]}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[0.688rem] text-muted">The league vets every registration. Contact details stay with the league office.</p>
    </section>
  );
}
