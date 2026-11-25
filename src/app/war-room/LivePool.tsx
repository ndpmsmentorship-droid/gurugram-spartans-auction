"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayerPhoto } from "@/app/register/PlayerCard";
import type { PoolEntry, PoolStatus } from "@/lib/auction/owner-pool";
import { MarkRow, MarkerKey } from "./Markers";

// Season 2 registrations as they come in, with the league's call on each:
// new, one check done, in the pool, or rejected. Refreshes every 30 s.
// The league's own four stages (same as its admin), so owners see exactly where each player stands.
type Tab = PoolStatus | "all" | "recommend";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "recommend", label: "Needs a recommendation" },
  { key: "new", label: "1. New · waiting" },
  { key: "fee_pending", label: "2. Profiling ✓ · fee pending" },
  { key: "profiling_pending", label: "3. Fee ✓ · profiling pending" },
  { key: "pool", label: "4. In the pool" },
  { key: "unpaid", label: "Payment pending" },
  { key: "rejected", label: "Rejected" },
];
const BADGE: Record<PoolStatus, string> = {
  unpaid: "border border-dashed border-red text-red-deep",
  new: "bg-wash text-muted",
  fee_pending: "bg-gold-fill text-gold",
  profiling_pending: "bg-gold-fill text-gold",
  pool: "bg-[color-mix(in_srgb,var(--up)_12%,transparent)] text-up",
  rejected: "bg-[color-mix(in_srgb,var(--red)_10%,transparent)] text-red-deep",
};
const LABEL: Record<PoolStatus, string> = {
  unpaid: "Payment pending",
  new: "New",
  fee_pending: "Profiling ✓ · fee pending",
  profiling_pending: "Fee ✓ · profiling pending",
  pool: "In the pool",
  rejected: "Rejected",
};

const fmt = (n: number | null, d = 0) => (n == null ? "–" : n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }));

function StatLine({ s }: { s: NonNullable<PoolEntry["stats"]> }) {
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
    </div>
  );
}

export function usePool() {
  const [pool, setPool] = useState<PoolEntry[] | null>(null);
  const [at, setAt] = useState<string | null>(null);
  const [team, setTeam] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const r = await fetch("/spartansscout/api/owner-pool", { cache: "no-store" }).catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) : null;
      if (alive && j?.pool) {
        setPool(j.pool);
        setAt(j.at);
        setTeam(j.team ?? null);
      }
    };
    pull();
    const id = setInterval(pull, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [tick]);
  return { pool, at, team, setPool, refresh: () => setTick((t) => t + 1) };
}

// An owner's Recommend button for a player whose profiling asked for a franchise owner's recommendation
// (Nikhil, 23 Nov 2026). Saved per team; the league still makes the final call.
function Recommend({ p, team, onDone }: { p: PoolEntry; team: string; onDone: (on: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async (on: boolean) => {
    if (on && !confirm(`Recommend ${p.name} for SLL-2 on behalf of ${team}?`)) return;
    setBusy(true);
    setErr(null);
    const r = await fetch("/spartansscout/api/owner-recommend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: p.id, on }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    setBusy(false);
    if (!r?.ok) return setErr(j?.error ?? "Couldn't save. Please try again.");
    onDone(on);
  };
  return p.mine ? (
    <span className="flex items-center gap-1.5">
      <span className="rounded-full bg-[color-mix(in_srgb,var(--up)_12%,transparent)] px-2 py-1 text-[0.688rem] font-semibold text-up">✓ You recommended</span>
      <button type="button" disabled={busy} onClick={() => send(false)} className="text-[0.625rem] text-muted underline">Withdraw</button>
      {err && <span className="text-[0.625rem] text-red-deep">{err}</span>}
    </span>
  ) : (
    <span className="flex flex-col items-end gap-0.5">
      <button type="button" disabled={busy} onClick={() => send(true)} className="rounded-full bg-ink px-3 py-1.5 text-[0.75rem] font-semibold text-white disabled:opacity-50">
        {busy ? "Saving…" : "Recommend"}
      </button>
      {err && <span className="text-[0.625rem] text-red-deep">{err}</span>}
    </span>
  );
}

export default function LivePool() {
  const { pool, at, team, setPool } = usePool();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: pool?.length ?? 0, recommend: 0, unpaid: 0, new: 0, fee_pending: 0, profiling_pending: 0, pool: 0, rejected: 0 };
    for (const p of pool ?? []) {
      c[p.status] += 1;
      if (p.recommend) c.recommend += 1;
    }
    return c;
  }, [pool]);
  const shown = (pool ?? []).filter(
    (p) => (tab === "all" || (tab === "recommend" ? p.recommend : p.status === tab)) && (!q.trim() || `${p.name} ${p.employer ?? ""} ${p.role}`.toLowerCase().includes(q.trim().toLowerCase())),
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
                <MarkRow p={p} />
                {p.stats && <StatLine s={p.stats} />}
              </div>
              <span className="mt-0.5 flex shrink-0 flex-col items-end gap-1">
                <span className={`rounded-full px-2 py-1 text-[0.688rem] ${BADGE[p.status]}`}>{LABEL[p.status]}</span>
                {p.recommend && <span className="rounded-full border border-line px-2 py-0.5 text-[0.625rem] text-ink">Needs an owner&rsquo;s recommendation</span>}
                {p.recommend && team && (
                  <Recommend
                    p={p}
                    team={team}
                    onDone={(on) =>
                      setPool((xs) =>
                        (xs ?? []).map((x) =>
                          x.id !== p.id ? x : { ...x, mine: on, recBy: on ? [...x.recBy.filter((t) => t !== team), team] : x.recBy.filter((t) => t !== team) },
                        ),
                      )
                    }
                  />
                )}
                {p.recommend && p.recBy.length > 0 && (
                  <span className="text-right text-[0.625rem] leading-snug text-muted">
                    {p.recBy.length === 1 ? "1 owner has" : `${p.recBy.length} owners have`} recommended
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[0.688rem] text-muted">
        The league vets every registration. Contact details stay with the league office.
        {team ? " Recommend a player who needs one; the league makes the final call." : ""}
      </p>
      <MarkerKey />
    </section>
  );
}
