"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayerPhoto } from "@/app/register/PlayerCard";
import type { PoolEntry, PoolStatus } from "@/lib/auction/owner-pool";
import { MarkRow, MarkerKey, CricHeroesLink } from "./Markers";

// Season 2 registrations as they come in, with the league's call on each:
// new, one check done, in the pool, or rejected. Refreshes every 30 s.
// The league's own four stages (same as its admin), so owners see exactly where each player stands.
type Tab = PoolStatus | "all" | "recommend";
// One colour per stage, used on the filter bar and on every card (Nikhil, 25 Nov 2026: a calmer, clearer look).
const STAGE: Record<Tab, { label: string; colour: string; hint: string }> = {
  all: { label: "All", colour: "#0b1630", hint: "Every Season 2 registration, newest first." },
  pool: { label: "In the pool", colour: "#2e7d50", hint: "Fee verified and corporate profiling passed — in the auction pool." },
  fee_pending: { label: "Fee pending", colour: "#b7791f", hint: "Profiling passed; the league is verifying the fee." },
  profiling_pending: { label: "Profiling pending", colour: "#2563eb", hint: "Fee verified; corporate profiling still to do." },
  new: { label: "New", colour: "#64748b", hint: "Just registered — fee and profiling both still to check." },
  recommend: { label: "Needs recommendation", colour: "#7c3aed", hint: "The league needs a franchise owner's recommendation before he can join the pool." },
  unpaid: { label: "Payment pending", colour: "#bc2423", hint: "Filled the form but hasn't paid the registration fee yet." },
  rejected: { label: "Rejected", colour: "#94a3b8", hint: "Not accepted by the league." },
};
const TABS: Tab[] = ["all", "pool", "fee_pending", "profiling_pending", "new", "recommend", "unpaid", "rejected"];

const Dot = ({ c, dashed }: { c: string; dashed?: boolean }) => (
  <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={dashed ? { border: `1.5px dashed ${c}` } : { background: c }} />
);

// The card's status: a tinted stage pill, then the two checks as ticks.
function Stage({ p }: { p: PoolEntry }) {
  const st = STAGE[p.status];
  const prof = p.status === "pool" || p.status === "fee_pending";
  const fee = p.status === "pool" || p.status === "profiling_pending" || p.feePaid;
  return (
    <span className="flex flex-col items-end gap-1">
      <span
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.72rem] font-semibold"
        style={{ background: `color-mix(in srgb, ${st.colour} 11%, transparent)`, color: st.colour }}
      >
        <Dot c={st.colour} dashed={p.status === "unpaid"} />
        {st.label}
      </span>
      {p.status !== "rejected" && p.status !== "unpaid" && (
        <span className="flex gap-2.5 text-[0.65rem] text-muted">
          <Tick ok={prof} l="Profiling" />
          <Tick ok={fee} l="Fee" />
        </span>
      )}
    </span>
  );
}
function Tick({ ok, l }: { ok: boolean; l: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${ok ? "text-up" : ""}`}>
      <span className={`grid h-3.5 w-3.5 place-items-center rounded-full text-[0.5rem] font-bold ${ok ? "bg-up text-white" : "border border-line2"}`}>{ok ? "✓" : ""}</span>
      {l}
    </span>
  );
}

const fmt = (n: number | null, d = 0) => (n == null ? "–" : n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }));

function StatLine({ s }: { s: NonNullable<PoolEntry["stats"]> }) {
  // Some imported figures are junk ("0/0", "0", or a spreadsheet date like 46299): treat those as missing.
  const bowlBest = s.best && /^\d{1,2}\/\d{1,3}$/.test(s.best.trim()) && !/^0\/0$/.test(s.best.trim()) ? s.best.trim() : null;
  const hs = s.hs && s.hs.trim() !== "0" && /^\d{1,3}\*?$/.test(s.hs.trim()) ? s.hs.trim() : "–";
  const cells: [string, string][] = [
    ["Mat", fmt(s.m)],
    ["Runs", fmt(s.runs)],
    ["Avg", fmt(s.avg, 1)],
    ["SR", fmt(s.sr, 1)],
    ["HS", hs],
    ["Wkts", fmt(s.wk)],
    ["Econ", fmt(s.econ, 2)],
    // Best bowling when we have a real figure (e.g. 5/12); otherwise his best score with the bat (Nikhil, 25 Nov 2026).
    bowlBest ? ["Best", bowlBest] : ["Best (bat)", hs],
  ];
  return (
    <div>
      <dl className="grid grid-cols-4 gap-px overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-8">
        {cells.map(([k, v], i) => (
          <div key={k} className={`flex flex-col-reverse px-1.5 py-1 text-center leading-tight ${i >= 5 ? "bg-[color-mix(in_srgb,var(--up)_4%,var(--surface))]" : "bg-surface"}`}>
            <dt className="text-[0.55rem] uppercase tracking-wide text-muted">{k}</dt>
            <dd className="num text-[0.78rem] font-semibold">{v}</dd>
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
  // Players who haven't given their role go to the bottom (Nikhil, 25 Nov 2026); order otherwise unchanged.
  const noRole = (p: PoolEntry) => /^role not given/i.test(p.role);
  const matching = (pool ?? [])
    .filter(
      (p) => (tab === "all" || (tab === "recommend" ? p.recommend : p.status === tab)) && (!q.trim() || `${p.name} ${p.employer ?? ""} ${p.role} ${p.tags.join(" ")}`.toLowerCase().includes(q.trim().toLowerCase())),
    )
    .sort((a, b) => Number(noRole(a)) - Number(noRole(b)));
  // Players per page: 10, 20 or 50 (Nikhil, 25 Nov 2026). A new tab, search or page size starts at page 1.
  const [size, setSize] = useState<10 | 20 | 50>(20);
  const pageKey = `${tab}|${q}|${size}`;
  const [pg, setPg] = useState({ key: "", n: 0 });
  const pages = Math.max(1, Math.ceil(matching.length / size));
  const page = pg.key === pageKey ? Math.min(pg.n, pages - 1) : 0;
  const goTo = (n: number) => {
    setPg({ key: pageKey, n });
    document.getElementById("pool-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const shown = matching.slice(page * size, page * size + size);
  const pick = (n: 10 | 20 | 50) => setSize(n);
  const pager = matching.length > 0 && (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[0.78rem]">
      <span className="text-muted">
        {page * size + 1}–{Math.min(matching.length, page * size + size)} of {matching.length}
      </span>
      <span className="flex items-center gap-1.5">
        <button type="button" disabled={page === 0} onClick={() => goTo(page - 1)} className="rounded-full border border-line px-3 py-1.5 disabled:opacity-40">
          ← Previous
        </button>
        <span className="px-1 tabular-nums text-muted">
          {page + 1} / {pages}
        </span>
        <button type="button" disabled={page >= pages - 1} onClick={() => goTo(page + 1)} className="rounded-full border border-line px-3 py-1.5 disabled:opacity-40">
          Next →
        </button>
      </span>
    </div>
  );

  return (
    <section id="pool-top" className="mx-auto w-full max-w-[1120px] scroll-mt-32">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">Live pool · Season 2</p>
          <h2 className="mt-1 font-display text-2xl font-bold uppercase leading-tight">Players as they register</h2>
        </div>
        {at && <p className="text-[0.75rem] text-muted">Updated {new Date(at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>}
      </div>

      <div className="mt-4 flex gap-1 overflow-x-auto rounded-[16px] border border-line bg-surface p-1 shadow-[var(--elev-sm)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((k) => {
          const st = STAGE[k];
          const on = tab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-pressed={on}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[12px] px-2.5 py-1.5 text-[0.8rem] transition ${on ? "bg-ink text-white" : "text-ink/75 hover:bg-wash"}`}
            >
              {k !== "all" && <Dot c={st.colour} dashed={k === "unpaid"} />}
              {st.label}
              <span className={`rounded-full px-1.5 text-[0.68rem] tabular-nums ${on ? "bg-white/20 text-white" : "bg-wash text-muted"}`}>{counts[k]}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 px-1 text-[0.75rem] text-muted">
        {tab !== "all" && <Dot c={STAGE[tab].colour} dashed={tab === "unpaid"} />}
        {STAGE[tab].hint}
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, company, role or tag"
        className="mt-3 w-full rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-red"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[0.78rem]">
          <span className="mr-1 text-muted">Show</span>
          {([10, 20, 50] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => pick(n)}
              aria-pressed={size === n}
              className={`rounded-full px-3 py-1 tabular-nums ${size === n ? "bg-ink text-white" : "border border-line text-muted hover:text-ink"}`}
            >
              {n}
            </button>
          ))}
          <span className="ml-1 text-muted">at a time</span>
        </span>
        {pool && matching.length > 0 && <span className="text-[0.78rem] text-muted">{matching.length} players</span>}
      </div>

      {pool === null ? (
        <p className="mt-6 text-sm text-muted">Loading the pool…</p>
      ) : matching.length === 0 ? (
        <p className="mt-6 rounded-[12px] border border-line p-4 text-sm text-muted">
          {pool.length ? "No players match." : "No registrations yet. Registrations open on Mon 2 Nov 2026; players appear here the moment they sign up."}
        </p>
      ) : (
        <>
        <div className="mt-3">{pager}</div>
        <ul className="mt-2 divide-y divide-line rounded-[12px] border border-line bg-surface">
          {shown.map((p) => (
            <li
              key={p.id}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-3 py-2.5 lg:grid-cols-[2.5rem_minmax(0,1.05fr)_minmax(0,1fr)_10.5rem] lg:items-center"
            >
              <PlayerPhoto src={p.photo} name={p.name} className="h-10 w-10 shrink-0 rounded-full" sizes="40px" />
              <div className="min-w-0">
                <p className="truncate text-[0.9rem] font-semibold leading-tight">{p.name}</p>
                <p className="truncate text-[0.72rem] leading-snug text-muted">
                  {[p.role, p.returning ? `Returning${p.lastTeam ? ` · S1 ${p.lastTeam}` : ""}` : "New player"].join(" · ")}
                </p>
                {(p.designation || p.employer) && <p className="truncate text-[0.72rem] leading-snug text-muted">{[p.designation, p.employer].filter(Boolean).join(", ")}</p>}
                <MarkRow p={p} inPool />
              </div>
              <div className="col-span-2 col-start-2 row-start-2 min-w-0 lg:col-span-1 lg:col-start-3 lg:row-start-1">
                {p.stats ? <StatLine s={p.stats} /> : <p className="text-[0.72rem] text-muted">No CricHeroes numbers yet</p>}
              </div>
              <span className="col-start-3 row-start-1 flex flex-col items-end gap-1.5 lg:col-start-4">
                <Stage p={p} />
                <CricHeroesLink href={p.chLink} />
                {p.recommend && (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.65rem] font-semibold" style={{ background: "color-mix(in srgb, #7c3aed 10%, transparent)", color: "#7c3aed" }}>
                    <Dot c="#7c3aed" /> Needs a recommendation
                  </span>
                )}
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
        <div className="mt-3">{pager}</div>
        </>
      )}
      <p className="mt-3 text-[0.688rem] text-muted">
        The league vets every registration. Contact details stay with the league office.
        {team ? " Recommend a player who needs one; the league makes the final call." : ""}
      </p>
      <MarkerKey />
    </section>
  );
}
