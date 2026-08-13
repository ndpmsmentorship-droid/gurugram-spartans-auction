"use client";

import { useMemo, useState, useTransition } from "react";
import { useLotSync } from "@/app/auction/useLotSync";
import {
  putUpLot,
  placeRaise,
  hammerLot,
  passLot,
  undoLastSale,
} from "./live-actions";
import { DEFAULT_RULES, blockReason, inr, raiseSteps } from "@/lib/auction/rules";

export type LotTeam = {
  id: string;
  name: string;
  purse_total: number;
  spent: number;
  squadSize: number;
};
export type LotPlayer = {
  id: string;
  full_name: string;
  auction_category: string | null;
  primary_role: string | null;
  overall_rank: number | null;
  is_marquee: boolean;
};
export type LotView = {
  status: "idle" | "live" | "sold" | "unsold";
  base_price: number | null;
  current_bid: number | null;
  leading_team_id: string | null;
  player: LotPlayer | null;
};

/**
 * The auctioneer's cockpit. One screen, one lot, four verbs: put up, raise,
 * hammer, pass. Buttons that would break a rule are disabled WITH THE REASON
 * on them — mid-lot is the wrong moment to read an error toast.
 */
export default function LotControl({
  lot,
  teams,
  available,
}: {
  lot: LotView;
  teams: LotTeam[];
  available: LotPlayer[];
}) {
  useLotSync();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState("");

  const run = (fn: () => Promise<{ error?: string }>) => {
    setErr(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setErr(res.error);
    });
  };

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return available.filter((p) => p.full_name.toLowerCase().includes(s)).slice(0, 7);
  }, [q, available]);

  const live = lot.status === "live";
  const base = lot.base_price ?? DEFAULT_RULES.baseGradeB;
  const steps = raiseSteps(lot.current_bid, base);
  const nextAmount = lot.current_bid == null ? base : steps[0];

  return (
    <section className="rounded-[12px] border border-line bg-surface">
      {/* ---- the lot ---- */}
      <div
        className="rounded-t-[12px] border-b border-line px-6 py-5"
        style={{
          background: live
            ? "linear-gradient(105deg, var(--blush-a) 0%, var(--blush-b) 60%, var(--surface) 100%)"
            : "var(--wash)",
        }}
      >
        {lot.player ? (
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="min-w-0">
              <p className="eyebrow">
                {lot.status === "sold"
                  ? "Sold"
                  : lot.status === "unsold"
                    ? "Unsold"
                    : "On the block"}
              </p>
              <h2 className="mt-2 flex items-center gap-2.5 font-display text-[2rem] leading-none">
                {lot.player.full_name}
                {lot.player.is_marquee && <span className="text-[1rem] text-gold">★</span>}
              </h2>
              <p className="num mt-2 text-[0.75rem] uppercase tracking-[0.12em] text-muted">
                {[
                  lot.player.auction_category,
                  lot.player.primary_role,
                  lot.player.overall_rank != null ? `Overall #${lot.player.overall_rank}` : null,
                  `Base ${inr(lot.base_price)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-[2.5rem] leading-none">
                {inr(lot.current_bid ?? lot.base_price)}
              </p>
              <p className="num mt-1.5 text-[0.75rem] text-muted">
                {lot.leading_team_id
                  ? teams.find((t) => t.id === lot.leading_team_id)?.name
                  : "No bids yet"}
              </p>
            </div>
          </div>
        ) : (
          <p className="label-mono py-1">No lot on the block</p>
        )}
      </div>

      {/* ---- put a player up ---- */}
      {!live && (
        <div className="border-b border-line px-6 py-5">
          <p className="label-mono mb-2.5">Put a player up</p>
          <div className="relative max-w-lg">
            <input
              className="input"
              placeholder="Search available players…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {matches.length > 0 && (
              <ul
                className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-[12px] border border-line bg-surface py-1"
                style={{ boxShadow: "var(--elev)" }}
              >
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setQ("");
                        run(() => putUpLot(p.id));
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-[0.875rem] transition hover:bg-wash hover:text-red"
                    >
                      <span className="truncate">{p.full_name}</span>
                      <span className="num shrink-0 text-[0.688rem] text-faint">
                        {p.auction_category}
                        {p.overall_rank != null ? ` · #${p.overall_rank}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-2.5 text-[0.75rem] text-muted">
            {available.length} players still available.
          </p>
        </div>
      )}

      {/* ---- take a bid ---- */}
      {live && (
        <>
          <div className="border-b border-line px-6 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-mono mr-1">Take bid at</span>
              {steps.map((amt) => (
                <button
                  key={amt}
                  disabled={pending}
                  onClick={() => setCustom(String(amt))}
                  data-active={custom === String(amt)}
                  className="pill num"
                >
                  {inr(amt)}
                </button>
              ))}
              <input
                className="input max-w-[9rem] py-2"
                inputMode="numeric"
                placeholder="Other…"
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>

            <p className="label-mono mt-4 mb-2.5">…from</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((t) => {
                const amount = Number(custom) || nextAmount;
                const reason = blockReason({
                  amount,
                  spent: t.spent,
                  purse: t.purse_total,
                  squadSize: t.squadSize,
                  isLeading: lot.leading_team_id === t.id,
                });
                return (
                  <button
                    key={t.id}
                    disabled={pending || !!reason}
                    onClick={() => run(() => placeRaise(t.id, amount))}
                    title={reason ?? `Take ${inr(amount)} from ${t.name}`}
                    className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-surface px-4 py-3 text-left transition enabled:hover:border-red enabled:hover:bg-wash disabled:opacity-40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[0.875rem] text-ink">{t.name}</span>
                      <span className="num mt-0.5 block text-[0.688rem] text-muted">
                        {reason ?? `${inr(t.purse_total - t.spent)} left · ${t.squadSize} in squad`}
                      </span>
                    </span>
                    <span className="num shrink-0 text-[0.75rem] font-medium text-red">
                      {inr(amount)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 px-6 py-5">
            <button
              disabled={pending || lot.leading_team_id == null}
              onClick={() => run(() => hammerLot())}
              className="btn-primary disabled:opacity-40"
              title={
                lot.leading_team_id == null
                  ? "No bids yet — pass the lot instead"
                  : "Sell to the leading team"
              }
            >
              Sold — hammer
            </button>
            <button
              disabled={pending}
              onClick={() => run(() => passLot())}
              className="btn-ghost"
            >
              Unsold — pass
            </button>
            <button
              disabled={pending}
              onClick={() => {
                if (confirm("Reverse the most recent sale?")) run(() => undoLastSale());
              }}
              className="label-mono ml-auto transition hover:!text-down"
            >
              Undo last sale
            </button>
          </div>
        </>
      )}

      {!live && lot.player && (
        <div className="flex flex-wrap items-center gap-3 px-6 py-5">
          <span className="text-[0.813rem] text-muted">
            Lot closed. Put the next player up to continue.
          </span>
          <button
            disabled={pending}
            onClick={() => {
              if (confirm("Reverse the most recent sale?")) run(() => undoLastSale());
            }}
            className="label-mono ml-auto transition hover:!text-down"
          >
            Undo last sale
          </button>
        </div>
      )}

      {err && (
        <p
          className="border-t border-line px-6 py-3 text-[0.813rem]"
          style={{ color: "var(--down)", background: "color-mix(in srgb, var(--down) 7%, #fff)" }}
        >
          {err}
        </p>
      )}
    </section>
  );
}
