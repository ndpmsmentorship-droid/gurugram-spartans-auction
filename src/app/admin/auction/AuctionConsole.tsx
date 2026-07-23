"use client";

import { useState, useTransition } from "react";
import {
  advanceToPlayer,
  setAuctionStatus,
  settleCurrentPlayer,
} from "./actions";
import type { AuctionStatus } from "@/lib/supabase/types";

type AuctionState = {
  season_id: string;
  current_player_id: string | null;
  current_bid_amount: number | null;
  current_leading_team_id: string | null;
  status: AuctionStatus;
};

type PoolPlayer = {
  id: string;
  player_id: string;
  category: string | null;
  base_price: number;
  players: { full_name: string } | null;
};

type Team = {
  id: string;
  name: string;
  is_mock: boolean;
  purse_total: number;
  purse_remaining: number;
};

type CurrentPlayer = {
  category: string | null;
  base_price: number;
  batting_avg: number | null;
  batting_sr: number | null;
  wickets: number | null;
  economy: number | null;
  players: { full_name: string; primary_role: string | null } | null;
} | null;

export default function AuctionConsole({
  seasonId,
  auctionState,
  pool,
  teams,
  currentPlayer,
}: {
  seasonId: string;
  auctionState: AuctionState;
  pool: PoolPlayer[];
  teams: Team[];
  currentPlayer: CurrentPlayer;
}) {
  const [pending, startTransition] = useTransition();
  const [selectedPlayer, setSelectedPlayer] = useState(pool[0]?.player_id ?? "");
  const leadingTeam = teams.find((t) => t.id === auctionState.current_leading_team_id);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Auction Console</h1>
        <div className="flex gap-2 text-sm">
          <StatusButton
            label="Start"
            active={auctionState.status === "live"}
            onClick={() =>
              startTransition(() => setAuctionStatus(seasonId, "live"))
            }
          />
          <StatusButton
            label="Pause"
            active={auctionState.status === "paused"}
            onClick={() =>
              startTransition(() => setAuctionStatus(seasonId, "paused"))
            }
          />
          <StatusButton
            label="End"
            active={auctionState.status === "ended"}
            onClick={() =>
              startTransition(() => setAuctionStatus(seasonId, "ended"))
            }
          />
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        Status: <span className="font-medium">{auctionState.status}</span>
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="font-medium">Current player</h2>
          {currentPlayer ? (
            <div className="mt-3 space-y-1 text-sm">
              <p className="text-base font-semibold">
                {currentPlayer.players?.full_name}
              </p>
              <p className="text-muted">
                {currentPlayer.players?.primary_role} · Category{" "}
                {currentPlayer.category ?? "—"}
              </p>
              <p>Base price: {currentPlayer.base_price}</p>
              <p>
                Bat avg {currentPlayer.batting_avg ?? "—"} · SR{" "}
                {currentPlayer.batting_sr ?? "—"} · Wkts{" "}
                {currentPlayer.wickets ?? "—"} · Econ{" "}
                {currentPlayer.economy ?? "—"}
              </p>
              <p className="mt-2 text-lg font-semibold text-accent">
                Current bid: {auctionState.current_bid_amount ?? "—"}
                {leadingTeam && (
                  <span className="ml-2 text-sm font-normal text-muted">
                    ({leadingTeam.name})
                  </span>
                )}
              </p>
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(() => settleCurrentPlayer(seasonId))
                }
                className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                Mark sold / unsold
              </button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">
              No player currently up for auction.
            </p>
          )}

          <div className="mt-5 border-t border-border pt-4">
            <label className="mb-1 block text-xs font-medium text-muted">
              Advance to
            </label>
            <div className="flex gap-2">
              <select
                className="input"
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
              >
                {pool.map((p) => (
                  <option key={p.id} value={p.player_id}>
                    {p.players?.full_name} ({p.category ?? "no category"})
                  </option>
                ))}
              </select>
              <button
                disabled={pending || !selectedPlayer}
                onClick={() =>
                  startTransition(() =>
                    advanceToPlayer(seasonId, selectedPlayer)
                  )
                }
                className="whitespace-nowrap rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-60"
              >
                Next player
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">
              {pool.length} players still in pool
            </p>
          </div>
        </section>

        <section className="card">
          <h2 className="font-medium">Teams</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-1">Team</th>
                <th className="py-1">Purse remaining</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-1.5">
                    {t.name}
                    {t.is_mock && (
                      <span className="badge ml-2 bg-background text-muted">
                        mock
                      </span>
                    )}
                  </td>
                  <td className="py-1.5">
                    {t.purse_remaining.toLocaleString()} /{" "}
                    {t.purse_total.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function StatusButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border hover:border-primary"
      }`}
    >
      {label}
    </button>
  );
}
