"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlayerPhoto } from "@/app/register/PlayerCard";
import { findFranchise } from "@/app/franchises";
import type { AgeBand, PoolEntry } from "@/lib/auction/owner-pool";
import { usePool } from "./LivePool";
import { MarkRow, AgeChip } from "./Markers";

// The Plan tab (Nikhil, 25 Nov 2026): the owner's own playing XII is the whole job.
// Left: the twelve in batting order, grouped Top order · Middle order · Lower-order hitters ·
// Bowlers. The franchise's own owners are placed first and can't be taken out.
// Right: tap a slot (or a group) and the best players in the live pool for that role are
// listed, sorted, with search and filters (pace / spin, age bracket). Picking one puts him
// straight into the XII on the left. Saved on this device, per login and team.

type Kind = "open" | "top" | "mid" | "wk" | "fin" | "ar" | "pace" | "spin" | "bowl";
type Group = "top" | "middle" | "lower" | "bowl";
const SLOTS: { kind: Kind; label: string; group: Group }[] = [
  { kind: "open", label: "Opener", group: "top" },
  { kind: "open", label: "Opener", group: "top" },
  { kind: "top", label: "No. 3", group: "top" },
  { kind: "mid", label: "No. 4", group: "middle" },
  { kind: "mid", label: "No. 5", group: "middle" },
  { kind: "wk", label: "No. 6 · wicket-keeper", group: "middle" },
  { kind: "fin", label: "No. 7 · finisher", group: "lower" },
  { kind: "ar", label: "No. 8 · all-rounder", group: "lower" },
  { kind: "ar", label: "No. 9 · all-rounder", group: "lower" },
  { kind: "pace", label: "No. 10 · pace bowler", group: "bowl" },
  { kind: "spin", label: "No. 11 · spin bowler", group: "bowl" },
  { kind: "bowl", label: "No. 12 · bowler", group: "bowl" },
];
const GROUPS: { key: Group; title: string; tone: string; lists: Kind[] }[] = [
  { key: "top", title: "Top-order batters", tone: "#2563eb", lists: ["open", "top"] },
  { key: "middle", title: "Middle-order batters", tone: "#b7791f", lists: ["mid", "wk"] },
  { key: "lower", title: "Lower-order hitters", tone: "#7c3aed", lists: ["fin", "ar"] },
  { key: "bowl", title: "Bowlers", tone: "#2e7d50", lists: ["pace", "spin", "bowl"] },
];
const LIST_LABEL: Record<Kind, string> = {
  open: "Openers",
  top: "Top order",
  mid: "Middle order",
  wk: "Wicket-keepers",
  fin: "Finishers",
  ar: "All-rounders",
  pace: "Pace bowlers",
  spin: "Spin bowlers",
  bowl: "All bowlers",
};
const groupOf = (k: Kind) => GROUPS.find((g) => g.lists.includes(k))!.key;

const per = (x: number | null, m: number | null) => (x != null && m ? x / m : 0);
const SPIN = /spin|off.?break|leg.?break|orthodox|chinaman|googly|slow left/i;
const PACE = /fast|medium|pace|seam|swing/i;

// What a player mainly is, from his form answers and CricHeroes numbers.
function kindOf(p: PoolEntry): "wk" | "ar" | "bowl" | "bat" {
  if (p.keeper) return "wk";
  if (/all.?rounder/i.test(p.role) && !/not an all.?rounder/i.test(p.role)) return "ar";
  const s = p.stats;
  if (s && per(s.wk, s.m) >= 0.6 && per(s.runs, s.m) < 12) return "bowl";
  return "bat";
}

// How well he fits a role: batting = runs a match × strike rate (finishers weigh strike rate
// more), bowling = wickets a match × economy, keepers add dismissals behind the stumps.
function fit(p: PoolEntry, kind: Kind): number {
  const s = p.stats;
  if (!s || (s.m ?? 0) < 20) return 0;
  const rpm = per(s.runs, s.m), sr = (s.sr ?? 100) / 100, wpm = per(s.wk, s.m), econ = Math.max(5, s.econ ?? 9);
  const bat = rpm * sr, bowl = wpm * 25 * (9 / econ);
  switch (kind) {
    case "open":
    case "top":
      return bat * (s.avg && s.avg > 20 ? 1.1 : 1);
    case "mid":
      return bat;
    case "fin":
      return rpm * sr * sr;
    case "wk":
      return p.keeper ? bat + per((s.ct ?? 0) + (s.stp ?? 0), s.m) * 12 : 0;
    case "ar":
      return wpm >= 0.4 && rpm >= 10 ? bat + bowl : 0;
    case "pace":
      return PACE.test(p.role) && !SPIN.test(p.role) ? bowl : 0;
    case "spin":
      return SPIN.test(p.role) ? bowl : 0;
    case "bowl":
      return bowl;
  }
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const keyOf = (profileId: string, team: string) => `sll-xii:${profileId}:${norm(team)}`;
const empty = () => SLOTS.map(() => null as string | null);

function readSlots(k: string): (string | null)[] {
  try {
    const v = JSON.parse(localStorage.getItem(k) ?? "null");
    if (Array.isArray(v) && v.length === SLOTS.length) return v.map((x) => (typeof x === "string" ? x : null));
  } catch {
    /* fresh start */
  }
  return empty();
}

export default function DreamXII({ profileId, team }: { profileId: string; team: string }) {
  const { pool } = usePool();
  const storeKey = keyOf(profileId, team);
  const [slots, setSlots] = useState<(string | null)[]>(empty);
  // The slot the right column is filling: the owner's choice, else the first empty slot.
  const [selRaw, setSel] = useState<number | null>(null);
  const [listRaw, setList] = useState<Kind | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Read the saved XII, and follow it if another tab of this browser changes it.
  useEffect(() => {
    const sync = () => setSlots(readSlots(storeKey));
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [storeKey]);

  const byId = useMemo(() => new Map((pool ?? []).map((p) => [p.id, p])), [pool]);
  const owners = useMemo(() => (pool ?? []).filter((p) => p.status !== "rejected" && norm(p.owner) === norm(team)), [pool, team]);
  const unregistered = useMemo(() => {
    const listed = findFranchise(team)?.owners ?? [];
    return listed.filter((n) => !owners.some((o) => norm(o.name).startsWith(norm(n).slice(0, 5))));
  }, [owners, team]);

  // Owners always sit in the XII: any not yet placed goes into the slot that suits him.
  const placed = useMemo(() => {
    const next = slots.map((id) => (id && (byId.has(id) || !pool) ? id : null));
    for (const o of owners) {
      if (next.includes(o.id)) continue;
      const k = kindOf(o);
      const wants: Kind[] = k === "wk" ? ["wk"] : k === "ar" ? ["ar"] : k === "bowl" ? ["pace", "spin", "bowl"] : ["open", "top", "mid", "fin"];
      let at = next.findIndex((id, i) => !id && wants.includes(SLOTS[i].kind));
      if (at < 0) at = next.findIndex((id) => !id);
      if (at < 0) at = next.findIndex((id) => !owners.some((x) => x.id === id));
      if (at >= 0) next[at] = o.id;
    }
    return next;
  }, [slots, owners, byId, pool]);

  const save = (next: (string | null)[]) => {
    setSlots(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {
      /* private mode: lasts for this visit */
    }
  };
  // Owners are placed on every render; their spot is saved with the owner's next change.

  const isOwner = (id: string | null) => !!id && owners.some((o) => o.id === id);
  const firstFree = placed.findIndex((x) => !x);
  const sel = selRaw ?? (firstFree >= 0 ? firstFree : 0);
  const list: Kind = listRaw ?? SLOTS[sel].kind;
  const filled = placed.filter(Boolean).length;

  // Put a player into the XII: the selected slot if it's free (or not an owner's), else the
  // first free slot in the same group, else the first free slot anywhere.
  const add = (id: string) => {
    const next = [...placed];
    const was = next.indexOf(id);
    if (was >= 0) next[was] = null;
    let at = isOwner(next[sel]) ? -1 : sel;
    if (at < 0) {
      const g = groupOf(list);
      at = next.findIndex((x, i) => !x && SLOTS[i].group === g);
      if (at < 0) at = next.findIndex((x) => !x);
    }
    if (at < 0) return;
    next[at] = id;
    save(next);
    const nextFree = next.findIndex((x) => !x);
    if (nextFree >= 0) choose(nextFree, false);
  };
  const remove = (i: number) => {
    if (isOwner(placed[i])) return;
    const next = [...placed];
    next[i] = null;
    save(next);
  };
  const swap = (a: number, b: number) => {
    const next = [...placed];
    [next[a], next[b]] = [next[b], next[a]];
    save(next);
  };
  const choose = (i: number, scroll = true) => {
    setSel(i);
    setList(SLOTS[i].kind);
    if (scroll && window.matchMedia("(max-width: 1023px)").matches) panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Your playing XII</p>
          <h2 className="mt-1 font-display text-2xl font-bold uppercase leading-tight">The twelve you have in mind</h2>
          <p className="mt-1 max-w-[62ch] text-sm text-muted">
            Your owners are in already. Tap a slot and the best players for that role are listed on the right — pick one, or search the whole pool.
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl font-bold leading-none tabular-nums">
            {filled}
            <span className="text-xl text-muted">/12</span>
          </p>
          <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-wash">
            <div className="h-full rounded-full bg-red transition-all" style={{ width: `${(filled / 12) * 100}%` }} />
          </div>
        </div>
      </div>
      {unregistered.length > 0 && (
        <p className="mt-3 rounded-[10px] border border-dashed border-line px-3 py-2 text-[0.75rem] text-muted">
          Owner{unregistered.length > 1 ? "s" : ""} not registered yet: <b className="text-ink">{unregistered.join(", ")}</b>. They join this XII automatically once they register and the league marks them as your owner.
        </p>
      )}

      <div className="mt-4 grid gap-5 lg:grid-cols-[5fr_6fr]">
        {/* left: the XII */}
        <div className="space-y-3">
          {GROUPS.map((g) => (
            <div key={g.key} className="overflow-hidden rounded-[14px] border border-line bg-surface" style={{ borderLeft: `4px solid ${g.tone}` }}>
              <button
                type="button"
                onClick={() => {
                  const i = SLOTS.findIndex((s, j) => s.group === g.key && !placed[j]);
                  choose(i >= 0 ? i : SLOTS.findIndex((s) => s.group === g.key));
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left"
                style={{ background: `color-mix(in srgb, ${g.tone} 9%, transparent)` }}
              >
                <span className="text-sm font-semibold" style={{ color: g.tone }}>{g.title}</span>
                <span className="rounded-full px-2 py-0.5 text-[0.68rem] font-semibold tabular-nums text-white" style={{ background: g.tone }}>
                  {SLOTS.filter((s, i) => s.group === g.key && placed[i]).length}/{SLOTS.filter((s) => s.group === g.key).length}
                </span>
              </button>
              <ol className="divide-y divide-line">
                {SLOTS.map((s, i) => {
                  if (s.group !== g.key) return null;
                  const p = placed[i] ? byId.get(placed[i]!) : undefined;
                  const owner = isOwner(placed[i]);
                  const active = sel === i;
                  return (
                    <li key={i} className={`flex items-center gap-2.5 px-3 py-2 ${active ? "bg-[color-mix(in_srgb,var(--red)_6%,transparent)]" : ""}`}>
                      <span className="w-5 shrink-0 text-right font-display tabular-nums text-muted">{i + 1}</span>
                      <button type="button" onClick={() => choose(i)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        {p ? (
                          <PlayerPhoto src={p.photo} name={p.name} className="h-9 w-9 shrink-0 rounded-full" sizes="36px" />
                        ) : (
                          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed text-lg ${active ? "border-red text-red" : "border-line2 text-muted"}`}>+</span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="label-mono block">{s.label}</span>
                          {p ? <span className="block truncate text-sm font-semibold">{p.name}</span> : <span className="block text-sm text-muted">{active ? "Choose on the right →" : "Tap to choose"}</span>}
                          {p && <MarkRow p={p} showCategory={false} />}
                        </span>
                      </button>
                      {p && owner && (
                        <select
                          aria-label={`Move ${p.name}`}
                          className="shrink-0 rounded-full border border-line bg-surface px-2 py-1 text-[0.72rem]"
                          value=""
                          onChange={(e) => e.target.value && swap(i, Number(e.target.value))}
                        >
                          <option value="">Move…</option>
                          {SLOTS.map((t, j) => (j === i ? null : <option key={j} value={j}>{`${j + 1}. ${t.label}`}</option>))}
                        </select>
                      )}
                      {p && !owner && (
                        <button type="button" onClick={() => remove(i)} aria-label={`Remove ${p.name}`} className="shrink-0 px-1.5 text-muted hover:text-red">
                          ✕
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          <p className="text-[0.68rem] text-muted">Saved on this device; private to your team.</p>
        </div>

        {/* right: recommendations for the chosen role */}
        <div ref={panel} className="scroll-mt-32 lg:sticky lg:top-32 lg:self-start">
          {pool === null ? (
            <p className="rounded-[14px] border border-line bg-surface p-4 text-sm text-muted">Loading the live pool…</p>
          ) : (
            <Panel
              pool={pool}
              team={team}
              list={list}
              setList={setList}
              slotLabel={`${sel + 1}. ${SLOTS[sel].label}`}
              slotTaken={placed[sel] ? (byId.get(placed[sel]!)?.name ?? null) : null}
              ownerSlot={isOwner(placed[sel])}
              inXII={new Set(placed.filter(Boolean) as string[])}
              onAdd={add}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function Panel({
  pool,
  team,
  list,
  setList,
  slotLabel,
  slotTaken,
  ownerSlot,
  inXII,
  onAdd,
}: {
  pool: PoolEntry[];
  team: string;
  list: Kind;
  setList: (k: Kind) => void;
  slotLabel: string;
  slotTaken: string | null;
  ownerSlot: boolean;
  inXII: Set<string>;
  onAdd: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [band, setBand] = useState<AgeBand | null>(null);
  const [paidOnly, setPaidOnly] = useState(false);
  const [moreFor, setMoreFor] = useState<Kind | null>(null);
  const more = moreFor === list;
  const setMore = (f: (m: boolean) => boolean) => setMoreFor(f(more) ? list : null);

  // Anyone registered, except rejected players and other franchises' owners.
  const avail = useMemo(
    () =>
      pool.filter(
        (p) => p.status !== "rejected" && (!p.owner || norm(p.owner) === norm(team)) && (!band || p.ageBand === band) && (!paidOnly || p.status !== "unpaid"),
      ),
    [pool, team, band, paidOnly],
  );
  const ranked = useMemo(
    () =>
      avail
        .map((p) => ({ p, f: fit(p, list) }))
        .filter((x) => x.f > 0)
        .sort((a, b) => b.f - a.f)
        .map((x) => x.p),
    [avail, list],
  );
  const found = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return null;
    return avail.filter((p) => `${p.name} ${p.employer ?? ""} ${p.role} ${p.tags.join(" ")}`.toLowerCase().includes(t)).slice(0, 20);
  }, [q, avail]);
  const shown = found ?? (more ? ranked.slice(0, 40) : ranked.slice(0, 10));
  const g = GROUPS.find((x) => x.lists.includes(list))!;

  return (
    <div className="rounded-[14px] border border-line bg-surface p-3.5 shadow-[var(--elev-sm)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow" style={{ color: g.tone }}>
          Filling {slotLabel}
        </p>
        {slotTaken && <p className="text-[0.72rem] text-muted">{ownerSlot ? `${slotTaken} (owner) stays — your pick goes to a free slot` : `replaces ${slotTaken}`}</p>}
      </div>

      {/* role lists: the four groups and their sub-lists */}
      <div className="mt-2.5 space-y-1.5">
        {GROUPS.map((x) => (
          <div key={x.key} className="flex flex-wrap items-center gap-1.5">
            <span className="w-[5.5rem] shrink-0 text-[0.68rem] font-semibold uppercase tracking-wide" style={{ color: x.tone }}>
              {x.title.split(" ")[0]}
            </span>
            {x.lists.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setList(k)}
                className="rounded-full border px-2.5 py-1 text-[0.75rem]"
                style={k === list ? { background: x.tone, borderColor: x.tone, color: "#fff" } : { borderColor: "var(--line)" }}
              >
                {LIST_LABEL[k]}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[0.68rem] text-muted">Age:</span>
        {(["30–34", "35–39", "40+"] as AgeBand[]).map((b) => (
          <button key={b} type="button" onClick={() => setBand(band === b ? null : b)} className={`rounded-full ${band === b ? "ring-2 ring-ink ring-offset-1" : "opacity-70"}`} aria-pressed={band === b}>
            <AgeChip band={b} />
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1 text-[0.72rem] text-muted">
          <input type="checkbox" checked={paidOnly} onChange={(e) => setPaidOnly(e.target.checked)} /> hide payment pending
        </label>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search any player — name, company, role or tag"
        className="mt-3 w-full rounded-full border border-line bg-background px-4 py-2 text-sm outline-none focus:border-red"
      />

      <p className="eyebrow mt-3">{found ? `Search · ${found.length}` : `Best ${LIST_LABEL[list].toLowerCase()} · ${ranked.length}`}</p>
      {shown.length ? (
        <ol className="mt-1.5 divide-y divide-line">
          {shown.map((p, i) => (
            <Choice key={p.id} n={found ? null : i + 1} p={p} inXII={inXII.has(p.id)} onAdd={onAdd} />
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-muted">{found ? "No player matches." : "No one with enough CricHeroes numbers for this role yet. Search instead."}</p>
      )}
      {!found && ranked.length > 10 && (
        <button type="button" onClick={() => setMore((m) => !m)} className="mt-1 text-[0.75rem] font-medium hover:underline" style={{ color: g.tone }}>
          {more ? "Show top 10" : `Show more (${Math.min(40, ranked.length)})`}
        </button>
      )}
      <p className="mt-3 border-t border-line pt-2 text-[0.68rem] leading-snug text-muted">
        Sorted on CricHeroes career numbers (20+ matches): runs a match × strike rate for batters (finishers weigh strike rate more), wickets a match × economy for bowlers, dismissals for keepers. Pace and spin come from the player&rsquo;s own bowling type.
      </p>
    </div>
  );
}

function Choice({ n, p, inXII, onAdd }: { n: number | null; p: PoolEntry; inXII: boolean; onAdd: (id: string) => void }) {
  const s = p.stats;
  const line = s
    ? [`${s.m ?? "–"} mat`, `${s.runs?.toLocaleString("en-IN") ?? "–"} runs`, s.sr ? `SR ${s.sr.toFixed(0)}` : null, `${s.wk ?? "–"} wkts`, s.econ ? `econ ${s.econ.toFixed(2)}` : null]
        .filter(Boolean)
        .join(" · ")
    : "No CricHeroes numbers yet";
  return (
    <li className={`flex items-center gap-2.5 py-2 ${inXII ? "opacity-60" : ""}`}>
      {n != null && <span className="w-5 shrink-0 text-right text-[0.75rem] tabular-nums text-muted">{n}</span>}
      <PlayerPhoto src={p.photo} name={p.name} className="h-9 w-9 shrink-0 rounded-full" sizes="36px" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{p.name}</p>
        <p className="truncate text-[0.7rem] text-muted">{p.role}</p>
        <p className="text-[0.7rem] tabular-nums text-ink/80">{line}</p>
        <MarkRow p={p} showCategory={false} />
      </div>
      <button
        type="button"
        onClick={() => onAdd(p.id)}
        className={`shrink-0 rounded-full px-3 py-1.5 text-[0.75rem] font-semibold ${inXII ? "border border-line text-muted" : "bg-ink text-white"}`}
      >
        {inXII ? "In XII · move" : "+ Wishlist"}
      </button>
    </li>
  );
}
