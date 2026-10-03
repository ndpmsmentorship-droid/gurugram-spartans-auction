"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLotSync } from "@/app/auction/useLotSync";
import { quickRaise, takeBackBid, hammerLot, passLot, withdrawLot, undoLastSale, putUpLot } from "../live-actions";
import { DEFAULT_RULES, blockReason, inr } from "@/lib/auction/rules";
import { catLabel, normCategory } from "@/lib/scout/tier";
import type { BoardData, Bid, QueuePlayer } from "@/lib/auction/board-data";
import Crest from "@/app/auction/screen/Crest";
import { CAT_COLOUR } from "@/app/auction/screen/BigScreen";

// The operator pad. One tap (or one key) on a team = that team bids the next
// step. The bid shows on the pad INSTANTLY and is written in the background,
// in order, so the operator can keep up with a room calling bids every second;
// the big screen follows over realtime.
//
//   1–9, 0, Q, W, E, R  team bids next step      Enter      SOLD
//   Backspace           take back the last bid   U          unsold (no bids)
//   N                   put up the next player   /          search the pool

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "q", "w", "e", "r", "t", "y"];
const STEPS = [500, 1000, 2000, 2500, 5000, 10000];

type View = { bid: number | null; leader: string | null; bids: Bid[]; gen: number };

// SDLL ladder: ₹500 steps to ₹20K, ₹1,000 to ₹50K, then ₹2,500 (rules.ts)
const autoStep = (bid: number) => (bid < 20000 ? 500 : bid < 50000 ? 1000 : 2500);

export default function OperatorPad({ board }: { board: BoardData }) {
  useLotSync(4000);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { lot, teams } = board;
  const live = lot.status === "live";

  const [opt, setOpt] = useState<View | null>(null);
  const optRef = useRef<View | null>(null);
  const gen = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const inflight = useRef(0);
  const [pending, setPending] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"auto" | number>("auto");
  const [jump, setJump] = useState("");
  const [q, setQ] = useState("");
  const search = useRef<HTMLInputElement>(null);

  const server: View = { bid: lot.current_bid, leader: lot.leading_team_id, bids: board.bids, gen: 0 };
  const v = opt ?? server;
  const base = lot.base_price ?? DEFAULT_RULES.base.B;
  const cat = board.player?.auction_category ?? null;
  const jumpAmt = Number(jump) || 0;
  const nextFrom = (bid: number | null) => {
    if (jumpAmt > (bid ?? base - 1)) return jumpAmt;
    if (bid == null) return base;
    return bid + (step === "auto" ? autoStep(bid) : step);
  };
  const nextAmount = nextFrom(v.bid);
  const leader = v.leader ? teams.find((t) => t.id === v.leader) : undefined;

  const reasonFor = (t: (typeof teams)[number], amount: number, leaderId: string | null) =>
    blockReason({
      amount,
      spent: t.spent,
      purse: t.purse_total,
      squadSize: t.squadSize,
      isLeading: leaderId === t.id,
      lotCategory: cat,
      categoryCount: (cat && t.catCounts[normCategory(cat) ?? ""]) || 0,
    });

  // Every write goes through one queue, so a SOLD pressed straight after three
  // quick raises lands after them, in order.
  const run = (fn: () => Promise<{ error?: string } | undefined>) => {
    setErr(null);
    inflight.current += 1;
    setPending((p) => p + 1);
    queue.current = queue.current.then(async () => {
      let res: { error?: string } | undefined;
      try {
        res = await fn();
      } catch (e) {
        res = { error: e instanceof Error ? e.message : "Network error — check the connection." };
      }
      if (res?.error) setErr(res.error);
      inflight.current -= 1;
      setPending((p) => p - 1);
      if (inflight.current === 0) {
        // swap the optimistic view for the server's in the same commit as the
        // fresh data — unless the operator has tapped again since
        const g = gen.current;
        startTransition(() => {
          setOpt((o) => (o && o.gen === g ? null : o));
          router.refresh();
        });
      }
    });
  };

  // what the next tap builds on: the optimistic view while one is showing,
  // otherwise the server's (fresh — they commit together)
  const current = () => (opt && optRef.current ? optRef.current : server);

  const bidFor = (teamId: string) => {
    if (!live) return;
    const cur = current();
    const t = teams.find((x) => x.id === teamId);
    if (!t) return;
    const amount = nextFrom(cur.bid);
    const why = reasonFor(t, amount, cur.leader);
    if (why) {
      setErr(`${t.name}: ${why}`);
      return;
    }
    gen.current += 1;
    const next: View = { bid: amount, leader: teamId, bids: [...cur.bids, { team_id: teamId, amount }], gen: gen.current };
    optRef.current = next;
    setOpt(next);
    setJump("");
    run(() => quickRaise(teamId, amount));
  };

  const takeBack = () => {
    if (!live) return;
    const cur = current();
    if (!cur.bids.length) return;
    const bids = cur.bids.slice(0, -1);
    const prev = bids[bids.length - 1];
    gen.current += 1;
    const next: View = { bid: prev?.amount ?? null, leader: prev?.team_id ?? null, bids, gen: gen.current };
    optRef.current = next;
    setOpt(next);
    run(() => takeBackBid());
  };

  const sell = () => {
    if (!live || !current().leader) return;
    run(() => hammerLot());
  };

  const putUp = (id: string) => {
    setQ("");
    gen.current += 1;
    optRef.current = null;
    setOpt(null);
    run(() => putUpLot(id));
  };

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return board.available.filter((p) => p.full_name.toLowerCase().includes(s)).slice(0, 8);
  }, [q, board.available]);

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
      if (e.key === "Escape") el.blur();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const i = KEYS.indexOf(k);
    if (i >= 0 && i < teams.length) {
      e.preventDefault();
      bidFor(teams[i].id);
    } else if (e.key === "Enter") {
      e.preventDefault();
      sell();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      takeBack();
    } else if (k === "u" && live && !current().bids.length) {
      run(() => passLot());
    } else if (k === "n" && !live && board.upNext[0]) {
      putUp(board.upNext[0].id);
    } else if (e.key === "/") {
      e.preventDefault();
      search.current?.focus();
    }
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const p = board.player;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#f7f1f0] text-ink">
      {/* ---- top bar ---- */}
      <header className="flex shrink-0 items-center gap-4 bg-[#360b09] px-5 py-2.5 text-white">
        <span className="font-display text-[1.1rem] font-bold tracking-[0.04em]">OPERATOR PAD</span>
        <span className="font-mono text-[0.75rem] uppercase tracking-[0.16em] text-white/60">Lot #{board.lotNo}</span>
        <span
          className="rounded-full px-2.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.16em]"
          style={{ background: live ? "#b12520" : lot.status === "sold" ? "#2e7d50" : "rgba(255,255,255,.15)" }}
        >
          {lot.status === "idle" ? "No lot" : lot.status}
        </span>
        <span className="font-mono text-[0.7rem] text-white/60">
          {board.sold} sold · {board.unsold} unsold · {board.available.length} in pool
        </span>
        <span className={`font-mono text-[0.7rem] ${pending ? "text-[#FFD27A]" : "text-white/40"}`}>
          {pending ? `saving ${pending}…` : "✓ saved"}
        </span>
        <span className="ml-auto flex items-center gap-4 font-mono text-[0.7rem] uppercase tracking-[0.14em]">
          <Link href="/auction/screen" target="_blank" className="text-white/80 hover:text-white">
            Big screen ↗
          </Link>
          <Link href="/admin/auction" className="text-white/50 hover:text-white">
            Console
          </Link>
        </span>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        {/* ---- left: the lot + the teams ---- */}
        <main className="flex min-w-0 flex-1 flex-col gap-3">
          {/* the lot */}
          <section
            className="flex shrink-0 items-center gap-6 rounded-[14px] border px-5 py-4"
            style={{
              borderColor: live ? "#b12520" : lot.status === "sold" ? "#2e7d50" : "var(--line)",
              background: live ? "linear-gradient(105deg, #f6e0de, #fff 70%)" : "#fff",
            }}
          >
            <div className="min-w-0 flex-1">
              {p && lot.status !== "idle" ? (
                <>
                  <p className="flex items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 font-display text-[0.8rem] font-bold text-[#250201]"
                      style={{ background: CAT_COLOUR[normCategory(p.auction_category) ?? "B"] }}
                    >
                      {catLabel(p.auction_category)}
                    </span>
                    <span className="font-mono text-[0.7rem] text-muted">
                      #{p.overall_rank ?? "—"} · {p.primary_role ?? "—"} · base {inr(lot.base_price)}
                    </span>
                  </p>
                  <p className="mt-1 truncate font-display text-[2rem] font-bold uppercase leading-none">
                    {p.full_name}
                    {p.is_marquee && <span className="ml-2 text-gold">★</span>}
                  </p>
                </>
              ) : (
                <p className="font-display text-[1.6rem] uppercase text-muted">
                  No lot — press <Kbd>N</Kbd> for {board.upNext[0]?.full_name ?? "the next player"}
                </p>
              )}
            </div>

            <div className="shrink-0 text-right">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">
                {lot.status === "sold" ? "Sold for" : v.bid == null ? "Opens at" : "Current bid"}
              </p>
              <p key={v.bid ?? 0} className="font-display text-[3rem] font-bold leading-none">
                {inr(v.bid ?? base)}
              </p>
              <p className="mt-1 text-[0.85rem] font-medium" style={{ color: leader ? "#2e7d50" : "var(--muted)" }}>
                {leader ? `${lot.status === "sold" ? "→ " : "Leading: "}${leader.name}` : "No bids yet"}
              </p>
            </div>

            {live && (
              <div className="flex shrink-0 flex-col gap-2">
                <button
                  onClick={sell}
                  disabled={!v.leader}
                  className="rounded-[10px] bg-[#2e7d50] px-6 py-3 font-display text-[1.3rem] font-bold uppercase tracking-[0.06em] text-white transition hover:brightness-110 disabled:opacity-35"
                >
                  Sold <Kbd dark>⏎</Kbd>
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={takeBack}
                    disabled={!v.bids.length}
                    className="flex-1 rounded-[8px] border border-line2 bg-white px-3 py-1.5 text-[0.75rem] font-medium hover:border-red disabled:opacity-35"
                    title="Take back the last bid (mis-tap)"
                  >
                    ↶ Bid <Kbd>⌫</Kbd>
                  </button>
                  <button
                    onClick={() => run(() => passLot())}
                    disabled={!!v.bids.length}
                    className="flex-1 rounded-[8px] border border-line2 bg-white px-3 py-1.5 text-[0.75rem] font-medium hover:border-red disabled:opacity-35"
                    title="No bids — record as unsold"
                  >
                    Unsold <Kbd>U</Kbd>
                  </button>
                  <button
                    onClick={() => run(() => withdrawLot())}
                    className="rounded-[8px] border border-line2 bg-white px-3 py-1.5 text-[0.75rem] font-medium hover:border-red"
                    title="Take off the block, no result — put up again later"
                  >
                    Later
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* step + jump */}
          <section className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted">Step</span>
            {(["auto", ...STEPS] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStep(s)}
                className="rounded-full border px-3 py-1 font-mono text-[0.75rem] transition"
                style={{
                  borderColor: step === s ? "#b12520" : "var(--line2)",
                  background: step === s ? "#b12520" : "#fff",
                  color: step === s ? "#fff" : "var(--ink)",
                }}
              >
                {s === "auto" ? `Auto +${inr(autoStep(v.bid ?? base)).slice(1)}` : `+${inr(s).slice(1)}`}
              </button>
            ))}
            <input
              className="ml-2 w-36 rounded-full border border-line2 bg-white px-3 py-1 font-mono text-[0.8rem]"
              inputMode="numeric"
              placeholder="Jump to ₹…"
              value={jump}
              onChange={(e) => setJump(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
            <span className="ml-auto font-mono text-[0.8rem]">
              {live ? (
                <>
                  Tap a team → <b className="text-red">{inr(nextAmount)}</b>
                </>
              ) : (
                <span className="text-muted">Teams unlock when a lot is live</span>
              )}
            </span>
          </section>

          {/* the teams — one tap each */}
          <section
            className="grid min-h-0 flex-1 gap-2.5"
            style={{ gridTemplateColumns: `repeat(${Math.ceil(teams.length / 2)}, minmax(0, 1fr))`, gridAutoRows: "1fr" }}
          >
            {teams.map((t, i) => {
              const leading = v.leader === t.id;
              const why = live ? reasonFor(t, nextAmount, v.leader) : "No lot";
              const off = !!why && !leading;
              return (
                <button
                  key={t.id}
                  onClick={() => bidFor(t.id)}
                  disabled={!live || !!why}
                  className="relative flex min-h-0 flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 bg-white px-2 py-2 text-center transition active:scale-[0.97] enabled:hover:border-[#b12520] enabled:hover:shadow-md"
                  style={{
                    borderColor: leading ? "#2e7d50" : "var(--line)",
                    background: leading ? "#e3f3ea" : "#fff",
                    opacity: off && live ? 0.4 : 1,
                  }}
                  title={why ?? `${t.name} bids ${inr(nextAmount)}`}
                >
                  <span className="absolute left-2 top-2 rounded bg-[#250201] px-1.5 py-0.5 font-mono text-[0.65rem] font-bold uppercase text-white">
                    {KEYS[i]}
                  </span>
                  {leading && (
                    <span className="absolute right-2 top-2 rounded bg-[#2e7d50] px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.1em] text-white">
                      Leading
                    </span>
                  )}
                  <Crest name={t.name} logo={t.logo} size="clamp(40px, 4.6vw, 88px)" />
                  <span className="line-clamp-2 text-[0.95rem] font-semibold leading-tight">{t.name}</span>
                  <span className="font-mono text-[0.7rem] text-muted">
                    {inr(t.purse_total - t.spent)} · {t.squadSize}/{board.squadMax}
                  </span>
                  {off && live ? (
                    <span className="font-mono text-[0.62rem] text-red">{why}</span>
                  ) : live && !leading ? (
                    <span className="font-mono text-[0.85rem] font-bold text-red">{inr(nextAmount)}</span>
                  ) : null}
                </button>
              );
            })}
          </section>

          {err && (
            <p className="shrink-0 rounded-[10px] bg-[#fbe4e2] px-4 py-2 text-[0.85rem] font-medium text-[#8e1a16]">
              {err}
            </p>
          )}
        </main>

        {/* ---- right: put up, ladder, sales ---- */}
        <aside className="flex w-[340px] shrink-0 flex-col gap-3 overflow-hidden">
          <section className="rounded-[14px] border border-line bg-white p-3">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted">Put up</p>
            <div className="relative mt-2">
              <input
                ref={search}
                className="w-full rounded-[8px] border border-line2 px-3 py-2 text-[0.85rem]"
                placeholder="Search the pool…  ( / )"
                value={q}
                disabled={live}
                onChange={(e) => setQ(e.target.value)}
              />
              {matches.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-[8px] border border-line bg-white shadow-lg">
                  {matches.map((m) => (
                    <QueueRow key={m.id} p={m} onClick={() => putUp(m.id)} />
                  ))}
                </ul>
              )}
            </div>
            <ul className="mt-2 flex flex-col">
              {board.upNext.map((m, i) => (
                <QueueRow key={m.id} p={m} first={i === 0} disabled={live} onClick={() => putUp(m.id)} />
              ))}
            </ul>
          </section>

          <section className="min-h-0 rounded-[14px] border border-line bg-white p-3">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted">Bids this lot</p>
            <ul className="mt-2 flex flex-col gap-1">
              {v.bids.length === 0 && <li className="text-[0.8rem] text-muted">—</li>}
              {v.bids
                .slice()
                .reverse()
                .slice(0, 7)
                .map((b, i) => (
                  <li key={`${b.amount}-${b.team_id}`} className="flex justify-between text-[0.8rem]" style={{ opacity: 1 - i * 0.1 }}>
                    <span className="truncate">{teams.find((t) => t.id === b.team_id)?.name}</span>
                    <span className="font-mono font-semibold">{inr(b.amount)}</span>
                  </li>
                ))}
            </ul>
          </section>

          <section className="min-h-0 flex-1 overflow-hidden rounded-[14px] border border-line bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted">Recent sales</p>
              <button
                onClick={() => {
                  if (confirm("Reverse the most recent sale?")) run(() => undoLastSale());
                }}
                disabled={!board.recent.length}
                className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted hover:text-red disabled:opacity-30"
              >
                Undo last sale
              </button>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {board.recent.map((s) => (
                <li key={s.id} className="flex justify-between gap-2 text-[0.8rem]">
                  <span className="min-w-0 truncate">
                    {s.player}
                    <span className="text-muted"> → {teams.find((t) => t.id === s.team_id)?.name}</span>
                  </span>
                  <span className="shrink-0 font-mono font-semibold text-[#2e7d50]">{inr(s.amount)}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="shrink-0 font-mono text-[0.6rem] leading-relaxed text-muted">
            Keys: team <Kbd>1</Kbd>…<Kbd>R</Kbd> · sold <Kbd>⏎</Kbd> · take back <Kbd>⌫</Kbd> · unsold <Kbd>U</Kbd> · next{" "}
            <Kbd>N</Kbd> · search <Kbd>/</Kbd>
          </p>
        </aside>
      </div>
    </div>
  );
}

function QueueRow({ p, first, disabled, onClick }: { p: QueuePlayer; first?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[0.82rem] transition enabled:hover:bg-[#f6e0de] disabled:opacity-50"
        style={{ background: first && !disabled ? "#fbeceb" : undefined }}
      >
        <span
          className="w-7 shrink-0 rounded text-center font-display text-[0.7rem] font-bold text-[#250201]"
          style={{ background: CAT_COLOUR[normCategory(p.auction_category) ?? "B"] }}
        >
          {catLabel(p.auction_category)}
        </span>
        <span className="min-w-0 flex-1 truncate">{p.full_name}</span>
        {first && !disabled ? <Kbd>N</Kbd> : <span className="font-mono text-[0.65rem] text-muted">#{p.overall_rank ?? "—"}</span>}
      </button>
    </li>
  );
}

function Kbd({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <kbd
      className={`mx-0.5 inline-block rounded border px-1 font-mono text-[0.65em] font-semibold ${
        dark ? "border-white/40 text-white/80" : "border-line2 bg-white text-ink"
      }`}
    >
      {children}
    </kbd>
  );
}
