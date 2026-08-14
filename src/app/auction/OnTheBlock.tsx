"use client";

import { inr } from "@/lib/auction/rules";
import PlayerIdentity, { type LotPlayerDetail } from "./PlayerIdentity";

export type BlockPlayer = LotPlayerDetail;

export type BlockState = {
  status: "idle" | "live" | "sold" | "unsold";
  base_price: number | null;
  current_bid: number | null;
  leadingTeam: string | null;
  player: BlockPlayer | null;
};

/**
 * What the room looks at between calls. Deliberately the loudest thing on the
 * board — during a lot it should be readable from the back of the hall, and
 * when nothing is up it collapses to a single quiet line rather than holding
 * a big empty frame.
 */
export default function OnTheBlock({ state }: { state: BlockState }) {
  const { status, player } = state;

  if (status === "idle" || !player) {
    return (
      <div className="flex items-center gap-3 rounded-[12px] border border-dashed border-line2 px-5 py-4">
        <span className="h-2 w-2 shrink-0 rounded-full bg-line2" />
        <p className="label-mono">No lot on the block — waiting for the auctioneer</p>
      </div>
    );
  }

  const sold = status === "sold";
  const unsold = status === "unsold";
  const price = state.current_bid ?? state.base_price ?? 0;

  return (
    <div
      className="overflow-hidden rounded-[12px] border"
      style={{
        borderColor: sold ? "var(--up)" : unsold ? "var(--line2)" : "var(--red)",
        background: unsold
          ? "var(--wash)"
          : "linear-gradient(105deg, var(--blush-a) 0%, var(--blush-b) 58%, var(--surface) 100%)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-6 px-6 py-5 sm:px-7">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.22em]">
            {status === "live" && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red" />
              </span>
            )}
            <span style={{ color: sold ? "var(--up)" : unsold ? "var(--muted)" : "var(--red)" }}>
              {sold ? "Sold" : unsold ? "Unsold — back to the pool" : "On the block"}
            </span>
          </p>

          <div className="mt-3">
            <PlayerIdentity player={player} />
          </div>
          <p className="num mt-2 text-[0.688rem] text-faint">Base {inr(state.base_price)}</p>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          <p
            className="font-display leading-[0.85]"
            style={{
              fontSize: "clamp(2.5rem, 6vw, 4rem)",
              color: sold ? "var(--up)" : unsold ? "var(--muted)" : "var(--ink)",
            }}
          >
            {state.current_bid == null ? inr(state.base_price) : inr(state.current_bid)}
          </p>
          <p className="num mt-2 text-[0.813rem] text-muted">
            {state.leadingTeam ? (
              <>
                {sold ? "Sold to " : "Leading: "}
                <span className="font-medium text-ink">{state.leadingTeam}</span>
              </>
            ) : unsold ? (
              "No bids"
            ) : (
              "No bids yet — opens at base"
            )}
          </p>
          {/* the price the room is actually being asked for, not the last one taken */}
          {status === "live" && state.current_bid != null && (
            <p className="label-mono mt-1">Current bid {inr(price)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
