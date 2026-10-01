"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignPlayer, rtmPlayer } from "./actions";
import { rtmState, RTM_MAX_AGAINST } from "@/lib/auction/rtm";
import { inr } from "@/lib/auction/rules";
import type { ConsolePlayer, ConsoleTeam } from "./AuctionConsole";

// USCL Right to Match, for the helper. Flow at the table:
//   1. hammer falls -> Sell as usual (Lot control)
//   2. an existing franchise calls RTM -> the winner may revise its bid once
//   3. matched  -> tap that franchise below (player moves at the revised price)
//      declined -> "Stays with <winner>" records the revised price
export default function RtmPanel({
  teams,
  players,
  lastSoldId,
}: {
  teams: ConsoleTeam[];
  players: ConsolePlayer[];
  lastSoldId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const sales = useMemo(
    () => players.filter((p) => p.acquired === "auction" && p.team_id).sort((a, b) => (a.id === lastSoldId ? -1 : b.id === lastSoldId ? 1 : a.full_name.localeCompare(b.full_name))),
    [players, lastSoldId]
  );
  const [pid, setPid] = useState("");
  const player = sales.find((p) => p.id === pid) ?? sales[0] ?? null;
  const [priceStr, setPriceStr] = useState("");
  const price = priceStr === "" ? Number(player?.sold_price) || 0 : Number(priceStr);

  const state = useMemo(() => rtmState(teams, players), [teams, players]);
  const name = (id: string | null | undefined) => teams.find((t) => t.id === id)?.name ?? "—";
  const spent = (id: string) => players.reduce((s, p) => s + (p.team_id === id ? Number(p.sold_price) || 0 : 0), 0);
  const left = (id: string) => (teams.find((t) => t.id === id)?.purse_total ?? 0) - spent(id);
  const winner = player?.team_id ?? null;
  const capped = winner ? (state.against.get(winner) ?? 0) >= RTM_MAX_AGAINST : false;

  function run(fn: () => Promise<{ error?: string }>, ok: string) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r?.error) setMsg({ text: r.error, bad: true });
      else {
        setMsg({ text: ok });
        setPid("");
        setPriceStr("");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Right to Match</h2>
      <p className="mb-4 text-xs text-muted">
        Sell first. If an RTM is called, the winner may revise once — then record the outcome here. One RTM per existing franchise, max {RTM_MAX_AGAINST} against any team.
      </p>

      <div className="mb-4 flex flex-wrap gap-1.5 text-[11px]">
        {[...state.holders].map(([id, used]) => (
          <span key={id} className={`rounded-full px-2 py-0.5 ${used ? "bg-wash text-muted line-through" : "bg-accent/10 font-medium text-accent-text"}`} title={used ? `Used on ${used.full_name}` : "RTM available"}>
            {name(id)}{used ? ` · ${used.full_name}` : " · RTM"}
          </span>
        ))}
      </div>

      {sales.length === 0 ? (
        <p className="text-sm text-muted">No auction sales yet.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_160px]">
            <div>
              <label className="mb-1 block text-xs text-muted">Sold player (latest first)</label>
              <select
                value={player?.id ?? ""}
                onChange={(e) => { setPid(e.target.value); setPriceStr(""); }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {sales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} → {name(p.team_id)} · {inr(Number(p.sold_price) || 0)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Revised / matched price (₹)</label>
              <input
                type="number"
                inputMode="numeric"
                value={priceStr === "" ? String(Number(player?.sold_price) || "") : priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>

          {player && winner && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {capped ? (
                <span className="text-xs text-muted">{name(winner)} already lost {RTM_MAX_AGAINST} players to RTM — no more RTMs against them.</span>
              ) : (
                [...state.holders]
                  .filter(([id, used]) => !used && id !== winner)
                  .map(([id]) => {
                    const short = left(id) < price;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={pending || short}
                        title={short ? `Only ${inr(left(id))} left` : undefined}
                        onClick={() => run(() => rtmPlayer(player.id, id, price), `RTM: ${player.full_name} → ${name(id)} at ${inr(price)}`)}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                      >
                        {name(id)} matched
                      </button>
                    );
                  })
              )}
              {price !== Number(player.sold_price) && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => assignPlayer(player.id, winner, price), `RTM declined: ${player.full_name} stays with ${name(winner)} at ${inr(price)}`)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-wash disabled:opacity-60"
                >
                  Declined — stays with {name(winner)} at {inr(price)}
                </button>
              )}
            </div>
          )}
          {msg && <p className={`text-xs ${msg.bad ? "text-down" : "text-up"}`}>{msg.text}</p>}
        </div>
      )}
    </div>
  );
}
