"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlayerPhoto } from "@/app/register/PlayerCard";
import { findFranchise } from "@/app/franchises";
import type { AgeBand, Category, PoolEntry } from "@/lib/auction/owner-pool";
import { usePool } from "./LivePool";
import { MarkRow, AgeChip, CategoryChip } from "./Markers";

// The Plan tab (Nikhil, 25 Nov 2026): the owner's own playing XII is the whole job.
// Left: the twelve in batting order, grouped Top order · Middle order · Lower-order hitters ·
// Bowlers. The franchise's own owners are placed first and can't be taken out.
// Right: tap a slot (or a group) and the best players in the live pool for that role are
// listed, sorted, with search and filters (pace / spin, age bracket). Picking one puts him
// straight into the XII on the left. Saved on this device, per login and team.

type Kind = "open" | "top" | "mid" | "wk" | "fin" | "ar" | "pace" | "spin" | "bowl" | "any";
type Group = "top" | "middle" | "lower" | "bowl" | "bench";
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
  // The bench: six more for the mandatory squad of 18 (SLL-2 rules; Nikhil, 25 Nov 2026).
  { kind: "any", label: "Bench 1", group: "bench" },
  { kind: "any", label: "Bench 2", group: "bench" },
  { kind: "any", label: "Bench 3", group: "bench" },
  { kind: "any", label: "Bench 4", group: "bench" },
  { kind: "any", label: "Bench 5", group: "bench" },
  { kind: "any", label: "Bench 6", group: "bench" },
];
const XII = 12; // slots 1–12 play; 13–18 are the bench
const GROUPS: { key: Group; title: string; tone: string; lists: Kind[] }[] = [
  { key: "top", title: "Top-order batters", tone: "#2563eb", lists: ["open", "top"] },
  { key: "middle", title: "Middle-order batters", tone: "#b7791f", lists: ["mid", "wk"] },
  { key: "lower", title: "Lower-order hitters", tone: "#7c3aed", lists: ["fin", "ar"] },
  { key: "bowl", title: "Bowlers", tone: "#2e7d50", lists: ["pace", "spin", "bowl"] },
  { key: "bench", title: "Bench · 6 more for the squad of 18", tone: "#64748b", lists: ["any"] },
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
  any: "Best overall",
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
    case "any":
      return Math.max(bat, bowl, wpm >= 0.4 && rpm >= 10 ? bat + bowl : 0);
  }
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const keyOf = (profileId: string, team: string) => `sll-xii:${profileId}:${norm(team)}`;
const empty = () => SLOTS.map(() => null as string | null);

// Saves from before the bench existed have 12 slots: keep them and add six empty bench slots.
const pad = (v: unknown[]) => SLOTS.map((_, i) => (typeof v[i] === "string" ? (v[i] as string) : null));
function readSlots(k: string): (string | null)[] {
  try {
    const v = JSON.parse(localStorage.getItem(k) ?? "null");
    if (Array.isArray(v) && v.length >= XII) return pad(v);
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

  // The XII lives on the server (api/owner-xii) so phone and laptop show the same twelve; this
  // device keeps a copy so it opens instantly and survives a dropped connection.
  const [sync, setSync] = useState<"idle" | "saving" | "saved" | "offline">("idle");
  const lastEdit = useRef(0); // when this device last changed the XII
  const api = `/spartansscout/api/owner-xii?team=${encodeURIComponent(team)}`;
  const push = async (next: (string | null)[]) => {
    setSync("saving");
    const r = await fetch(api, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ team, slots: next }) }).catch(() => null);
    setSync(r?.ok ? "saved" : "offline");
  };
  useEffect(() => {
    let alive = true;
    const local = () => setSlots(readSlots(storeKey));
    const pull = async () => {
      const startedAt = Date.now();
      const r = await fetch(api, { cache: "no-store" }).catch(() => null);
      const j = r?.ok ? ((await r.json().catch(() => null)) as { slots: (string | null)[] | null; at: string | null } | null) : null;
      if (!alive || !j || lastEdit.current > startedAt) return; // an edit here since the pull started wins
      if (j.slots && j.slots.length >= XII) {
        const got = pad(j.slots);
        setSlots(got);
        try {
          localStorage.setItem(storeKey, JSON.stringify(got));
        } catch {
          /* fine */
        }
        setSync("saved");
      } else {
        // Nothing on the server yet: send up what this device has (XIIs made before syncing existed).
        const mine = readSlots(storeKey);
        if (mine.some(Boolean)) void push(mine);
      }
    };
    local();
    void pull();
    const onShow = () => document.visibilityState === "visible" && void pull();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("storage", local);
    const id = setInterval(pull, 60000);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("storage", local);
      clearInterval(id);
    };
  }, [storeKey, api]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (at < 0) at = next.findIndex((id, i) => !id && i < XII); // owners play: XII before the bench
      if (at < 0) at = next.findIndex((id) => !id);
      if (at < 0) at = next.findIndex((id) => !owners.some((x) => x.id === id));
      if (at >= 0) next[at] = o.id;
    }
    return next;
  }, [slots, owners, byId, pool]);

  const save = (next: (string | null)[]) => {
    lastEdit.current = Date.now();
    setSlots(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {
      /* private mode: the server copy still keeps it */
    }
    void push(next);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Your squad of 18 · playing XII + bench</p>
          <h2 className="mt-1 font-display text-2xl font-bold uppercase leading-tight">The squad you have in mind</h2>
          <p className="mt-1 max-w-[62ch] text-sm text-muted">
            Your owners are in already. Tap a slot and the best players for that role are listed <span className="lg:hidden">below the XII</span><span className="hidden lg:inline">on the right</span> — pick one, or search the whole pool.
          </p>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="flex items-baseline gap-2 sm:justify-end">
            <span className="font-display text-4xl font-bold leading-none tabular-nums">
              {filled}
              <span className="text-xl text-muted">/{SLOTS.length}</span>
            </span>
            <span className="text-[0.72rem] text-muted">picked</span>
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-wash sm:w-40">
            <div className="h-full rounded-full bg-red transition-all" style={{ width: `${(filled / SLOTS.length) * 100}%` }} />
          </div>
        </div>
      </div>
      {unregistered.length > 0 && (
        <p className="mt-3 rounded-[10px] border border-dashed border-line px-3 py-2 text-[0.75rem] text-muted">
          Owner{unregistered.length > 1 ? "s" : ""} not registered yet: <b className="text-ink">{unregistered.join(", ")}</b>. They join this XII automatically once they register and the league marks them as your owner.
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[5fr_6fr]">
        {/* left: the XII */}
        <div className="space-y-3">
          {GROUPS.map((g) => (
            <div key={g.key} className="rounded-[14px] border border-line bg-surface" style={{ borderLeft: `4px solid ${g.tone}` }}>
              <button
                type="button"
                onClick={() => {
                  const i = SLOTS.findIndex((s, j) => s.group === g.key && !placed[j]);
                  choose(i >= 0 ? i : SLOTS.findIndex((s) => s.group === g.key));
                }}
                className="flex w-full items-center justify-between rounded-tr-[13px] px-3 py-2 text-left"
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
                          {p ? <span className="block truncate text-sm font-semibold">{p.name}</span> : <span className="block text-sm text-muted">{active ? "Choose from the list →" : "Tap to choose"}</span>}
                          {p && <MarkRow p={p} />}
                        </span>
                      </button>
                      {p && (
                        <RowMenu
                          name={p.name}
                          at={i}
                          owner={owner}
                          names={placed.map((id) => (id ? (byId.get(id)?.name ?? null) : null))}
                          onMove={(j) => swap(i, j)}
                          onRemove={() => remove(i)}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          <RulesCheck xii={placed.map((id, i) => ({ p: id ? byId.get(id) : undefined, i }))} owners={owners} />
          <p className="text-[0.68rem] text-muted">
            {sync === "saving" ? "Saving…" : sync === "offline" ? "Saved on this device — couldn’t reach the server, will retry on your next change." : "Saved to your account: the same XII on your phone and laptop. Private to your team."}
          </p>
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
  const [catF, setCatF] = useState<Category | null>(null);
  const [moreFor, setMoreFor] = useState<Kind | null>(null);
  const more = moreFor === list;
  const setMore = (f: (m: boolean) => boolean) => setMoreFor(f(more) ? list : null);

  // Anyone registered, except rejected players and other franchises' owners.
  const avail = useMemo(
    () =>
      pool.filter(
        (p) => p.status !== "rejected" && (!p.owner || norm(p.owner) === norm(team)) && (!band || p.ageBand === band) && (!catF || p.cat === catF) && (!paidOnly || p.status !== "unpaid"),
      ),
    [pool, team, band, catF, paidOnly],
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
    const noRole = (p: PoolEntry) => /^role not given/i.test(p.role);
    return avail
      .filter((p) => `${p.name} ${p.employer ?? ""} ${p.role} ${p.tags.join(" ")}`.toLowerCase().includes(t))
      .sort((a, b) => Number(noRole(a)) - Number(noRole(b)))
      .slice(0, 20);
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
        {(["Under 35", "35–39", "40+"] as AgeBand[]).map((b) => (
          <button key={b} type="button" onClick={() => setBand(band === b ? null : b)} className={`rounded-full ${band === b ? "ring-2 ring-ink ring-offset-1" : "opacity-70"}`} aria-pressed={band === b}>
            <AgeChip band={b} />
          </button>
        ))}
        <span className="ml-2 text-[0.68rem] text-muted">Category:</span>
        {(["A+", "Legend"] as Category[]).map((c) => (
          <button key={c} type="button" onClick={() => setCatF(catF === c ? null : c)} className={`rounded-full ${catF === c ? "ring-2 ring-ink ring-offset-1" : "opacity-70"}`} aria-pressed={catF === c}>
            <CategoryChip cat={c} />
          </button>
        ))}
        <label className="flex basis-full items-center gap-1.5 pt-1 text-[0.72rem] text-muted">
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
        <MarkRow p={p} />
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

// The ✓/⚠ list under the XII: the playing-XII limits in the SLL-2 rules (Article 6).
function RulesCheck({ xii, owners }: { xii: { p: PoolEntry | undefined; i: number }[]; owners: PoolEntry[] }) {
  const all = xii.filter((x) => x.p) as { p: PoolEntry; i: number }[];
  const ps = all.filter((x) => x.i < XII); // the playing XII
  const squadLeg = all.filter((x) => x.p.cat === "Legend").length;
  const squadAPlus = all.filter((x) => x.p.cat === "A+").length;
  const u35 = ps.filter((x) => x.p.ageBand === "Under 35").length;
  const mid = ps.filter((x) => x.p.ageBand === "35–39").length;
  const legends = ps.filter((x) => x.p.cat === "Legend");
  const aPlus = ps.filter((x) => x.p.cat === "A+").length;
  const noDob = ps.filter((x) => !x.p.ageBand).length;
  const ownerU35 = owners.filter((o) => o.ageBand === "Under 35");
  const rows: { ok: boolean; text: string; head?: string }[] = [
    { ok: all.length === SLOTS.length, text: `Squad: ${all.length} of 18 — a squad of 18 is mandatory`, head: "Squad of 18" },
    { ok: squadLeg <= 2, text: `Legends in the squad: ${squadLeg} of 2` },
    { ok: squadAPlus <= 2, text: `A+ (under 35) in the squad: ${squadAPlus} of 2` },
    { ok: true, text: "A 6 · B 8 in the squad — checked once SPI grades are out" },
    { ok: u35 <= 1, text: `Under 35 (A+): ${u35} of max 1`, head: "Playing XII (slots 1–12)" },
    { ok: mid <= 4, text: `Aged 35–39: ${mid} of max 4` },
    { ok: legends.length <= 1, text: `Legend: ${legends.length} of max 1 (optional)` },
    ...(legends.length ? [{ ok: legends.every((x) => x.i <= 3), text: "A Legend must bat in the top 4" }] : []),
    { ok: true, text: aPlus ? "A cap: with an A+ playing, at most 4 A (the 6-A limit counts A+ as 2) — checked once SPI is out" : "A cap: at most 6 A in the XII — checked once SPI grades are out" },
    ...(ownerU35.length ? [{ ok: false, text: `No owner may be under 35: ${ownerU35.map((o) => o.name).join(", ")}` }] : []),
  ];
  return (
    <div className="rounded-[14px] border border-line bg-surface px-3 py-2.5">
      <p className="label-mono">Rules check · SLL-2 rules</p>
      <ul className="mt-1.5 space-y-1">
        {rows.map((r) => [
          r.head && (
            <li key={`h-${r.head}`} className="pt-1 text-[0.65rem] font-semibold uppercase tracking-wide text-ink/70">
              {r.head}
            </li>
          ),
          <li key={r.text} className="flex items-start gap-2 text-[0.75rem] leading-snug">
            <span className={`mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full text-[0.6rem] font-bold text-white ${r.ok ? "bg-up" : "bg-red"}`}>{r.ok ? "✓" : "!"}</span>
            <span className={r.ok ? "text-muted" : "font-semibold text-red-deep"}>{r.text}</span>
          </li>,
        ])}
        {noDob > 0 && <li className="pl-6 text-[0.7rem] text-muted">{noDob} in your XII without a date of birth on file — not counted in the age limits.</li>}
      </ul>
    </div>
  );
}

// One aligned action per filled slot: a Move button that opens the slot list (and Remove, except owners).
function RowMenu({
  name,
  at,
  owner,
  names,
  onMove,
  onRemove,
}: {
  name: string;
  at: number;
  owner: boolean;
  names: (string | null)[];
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent | TouchEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", off);
    document.addEventListener("touchstart", off);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", off);
      document.removeEventListener("touchstart", off);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={box} className="relative shrink-0 self-center">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Move ${name}`}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[0.75rem] font-medium transition ${open ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink hover:border-ink"}`}
      >
        Move
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" className={`transition ${open ? "rotate-180" : ""}`}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1.5 max-h-[60vh] w-64 overflow-y-auto rounded-[12px] border border-line bg-surface p-1.5 shadow-[var(--elev-md,0_10px_30px_rgba(0,0,0,.15))]">
          <p className="px-2 pb-1 pt-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">Move {name.split(" ")[0]} to</p>
          {SLOTS.map((t, j) =>
            j === at ? null : (
              <button
                key={j}
                role="menuitem"
                type="button"
                onClick={() => {
                  onMove(j);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[0.78rem] hover:bg-wash"
              >
                <span className="w-5 shrink-0 text-right font-display tabular-nums text-muted">{j + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{t.label}</span>
                  <span className="block truncate text-[0.68rem] text-muted">{names[j] ? `swap with ${names[j]}` : "empty"}</span>
                </span>
              </button>
            ),
          )}
          {!owner && (
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                onRemove();
                setOpen(false);
              }}
              className="mt-1 w-full rounded-[8px] border-t border-line px-2 py-2 text-left text-[0.78rem] font-medium text-red-deep hover:bg-[color-mix(in_srgb,var(--red)_6%,transparent)]"
            >
              Remove from XII
            </button>
          )}
          {owner && <p className="mt-1 border-t border-line px-2 pt-1.5 text-[0.68rem] text-muted">Owners always play — they can move, not leave the XII.</p>}
        </div>
      )}
    </div>
  );
}
