"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignPlayer, unassignPlayer, setPurse } from "./actions";

export type ConsoleTeam = {
  id: string;
  name: string;
  division: string | null;
  purse_total: number;
  purse_max: number | null;
};
export type ConsolePlayer = {
  id: string;
  full_name: string;
  auction_category: string | null;
  primary_role: string | null;
  is_keeper: boolean | null;
  age: number | null;
  team_id: string | null;
  sold_price: number | null;
  acquired: string | null;
};

const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

// ---- SCCL 6 rules helpers ----
const catCode = (c: string | null) => (c ?? "").toUpperCase().replace(/\s+/g, "");
const isLegend = (c: string | null) => catCode(c).includes("LEGEND");
// 'A' = U35A / 35+A. Legend is its own compulsory slot, priced as B — not an 'A'.
const isGradeA = (c: string | null) => !isLegend(c) && catCode(c).endsWith("A");
// Auction base price: 'A' ₹15K, everything else (B / Legend) ₹5K.
const basePrice = (c: string | null) => (isGradeA(c) ? 15000 : 5000);
const MAX_BID = 65000;
const SQUAD_MIN = 16;
const SQUAD_MAX = 20;

export default function AuctionConsole({
  teams,
  players,
}: {
  teams: ConsoleTeam[];
  players: ConsolePlayer[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ConsolePlayer | null>(null);
  const [teamId, setTeamId] = useState("");
  const [price, setPrice] = useState("");

  const spentByTeam = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of players) {
      if (p.team_id) m.set(p.team_id, (m.get(p.team_id) ?? 0) + (Number(p.sold_price) || 0));
    }
    return m;
  }, [players]);

  const available = useMemo(() => players.filter((p) => !p.team_id), [players]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return available.filter((p) => p.full_name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, available]);

  const selectedTeam = teams.find((t) => t.id === teamId) ?? null;
  const teamRemaining = selectedTeam ? selectedTeam.purse_total - (spentByTeam.get(selectedTeam.id) ?? 0) : 0;

  function run(fn: () => Promise<{ error?: string; ok?: boolean }>, okText: string) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setMsg({ text: res.error, bad: true });
      else {
        setMsg({ text: okText });
        router.refresh();
      }
    });
  }

  // picking a player prefills the category base price (A ₹15K / B ₹5K)
  function pick(p: ConsolePlayer) {
    setPicked(p);
    setQuery("");
    setPrice(String(basePrice(p.auction_category)));
  }

  function doAssign() {
    if (!picked) return setMsg({ text: "Pick a player first.", bad: true });
    if (!teamId) return setMsg({ text: "Pick a team.", bad: true });
    const amt = Number(price);
    if (!Number.isFinite(amt) || amt < 0) return setMsg({ text: "Enter a valid price.", bad: true });
    if (amt > 100000) return setMsg({ text: "Max bid is ₹1,00,000 (sealed-tender ceiling).", bad: true });
    run(() => assignPlayer(picked.id, teamId, amt), `${picked.full_name} → ${selectedTeam?.name} at ${inr(amt)}`);
    setPicked(null);
    setQuery("");
    setPrice("");
  }

  const byDivision = ["Elite", "Challengers", "Fighters"];
  const soldCount = players.length - available.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Auction Console</h1>
        <p className="text-sm text-muted tabular-nums">
          {soldCount} sold · {available.length} available · {teams.length} teams
        </p>
      </div>
      <p className="rounded-lg border border-border bg-wash px-3 py-2 text-xs leading-relaxed text-muted">
        Squad {SQUAD_MIN}–{SQUAD_MAX} (incl. owners, retained &amp; legend) · max 4 aged 30–35 · ≥1 legend ·
        base ₹15K (A) / ₹5K (B) · max bid {inr(MAX_BID)} (₹1L in tie-breaker)
      </p>

      {/* Assign */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Record a purchase</h2>
        <div className="grid gap-4 md:grid-cols-[1fr_220px_160px_auto] md:items-end">
          {/* player search */}
          <div className="relative">
            <label className="mb-1 block text-xs text-muted">Player</label>
            {picked ? (
              <div className="flex items-center justify-between rounded-lg border border-accent/40 bg-wash px-3 py-2 text-sm">
                <span className="font-medium">
                  {picked.full_name}
                  {picked.auction_category ? <span className="ml-2 text-xs text-muted">{picked.auction_category}</span> : null}
                </span>
                <button type="button" className="text-muted hover:text-ink" onClick={() => setPicked(null)}>✕</button>
              </div>
            ) : (
              <>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search available players…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                />
                {matches.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-surface shadow-lg">
                    {matches.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => pick(p)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-wash"
                        >
                          <span>{p.full_name}</span>
                          <span className="text-xs text-muted">
                            {[p.auction_category, p.primary_role].filter(Boolean).join(" · ")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          {/* team */}
          <div>
            <label className="mb-1 block text-xs text-muted">Team</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">Select team…</option>
              {byDivision.map((d) => (
                <optgroup key={d} label={d}>
                  {teams.filter((t) => t.division === d).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {/* price */}
          <div>
            <label className="mb-1 block text-xs text-muted">Price (₹)</label>
            <input
              type="number"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 20000"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:border-accent"
            />
          </div>
          <button
            type="button"
            onClick={doAssign}
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Assign"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          {picked && (
            <span className="text-muted tabular-nums">
              Base {inr(basePrice(picked.auction_category))} · max {inr(MAX_BID)}
              {Number(price) > MAX_BID ? <span className="ml-1 text-highlight-ink">(tie-breaker)</span> : null}
            </span>
          )}
          {selectedTeam && (
            <span className="text-muted tabular-nums">
              {selectedTeam.name} has <b className={teamRemaining < 0 ? "text-down" : "text-ink"}>{inr(teamRemaining)}</b> left
            </span>
          )}
          {msg && <span className={msg.bad ? "text-down" : "text-up"}>{msg.text}</span>}
        </div>
      </div>

      {/* Teams + rosters */}
      <div className="grid gap-4 lg:grid-cols-2">
        {teams.map((t) => {
          const roster = players
            .filter((p) => p.team_id === t.id)
            .sort((a, b) => (Number(b.sold_price) || 0) - (Number(a.sold_price) || 0));
          const spent = spentByTeam.get(t.id) ?? 0;
          const remaining = t.purse_total - spent;
          const pct = Math.min(100, (spent / t.purse_total) * 100);
          const canExtend = t.purse_max != null && t.purse_total < t.purse_max;
          const aCount = roster.filter((p) => isGradeA(p.auction_category)).length;
          const hasLegend = roster.some((p) => isLegend(p.auction_category));
          const age3035 = roster.filter((p) => p.age != null && p.age >= 30 && p.age <= 35).length;
          return (
            <div key={t.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-muted">{t.division} · {roster.length} players</div>
                </div>
                <div className="text-right text-xs tabular-nums">
                  <div className={remaining < 0 ? "text-down font-semibold" : "font-semibold"}>{inr(remaining)} left</div>
                  <div className="text-muted">of {inr(t.purse_total)}</div>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wash">
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                <Chip label={`Squad ${roster.length}/${SQUAD_MAX}`} warn={roster.length > SQUAD_MAX} />
                <Chip label={`30–35: ${age3035}/4`} warn={age3035 > 4} />
                <Chip label={`A: ${aCount}`} />
                <Chip label={hasLegend ? "Legend ✓" : "Legend ✗"} warn={!hasLegend} />
              </div>
              {canExtend && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setPurse(t.id, t.purse_max as number), `${t.name} purse raised to ${inr(t.purse_max as number)}`)}
                  className="mt-2 text-xs font-medium text-accent hover:underline disabled:opacity-60"
                >
                  Extend purse to {inr(t.purse_max as number)}
                </button>
              )}
              {roster.length > 0 && (
                <ul className="mt-3 divide-y divide-border/70 text-sm">
                  {roster.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="truncate">
                        {p.full_name}
                        {p.acquired === "retained" && <span className="ml-2 text-[10px] uppercase text-highlight">retained</span>}
                        {p.acquired === "owner" && <span className="ml-2 text-[10px] uppercase text-accent-text">owner</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tabular-nums text-muted">{inr(Number(p.sold_price) || 0)}</span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => unassignPlayer(p.id), `${p.full_name} removed`)}
                          title="Undo"
                          className="text-muted hover:text-down disabled:opacity-60"
                        >✕</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ label, warn }: { label: string; warn?: boolean }) {
  return (
    <span
      className={`rounded-full bg-wash px-2 py-0.5 tabular-nums ${
        warn ? "font-semibold text-down" : "text-muted"
      }`}
    >
      {label}
    </span>
  );
}
