"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { placeBid } from "./actions";

type AuctionState = {
  season_id: string;
  current_player_id: string | null;
  current_bid_amount: number | null;
  current_leading_team_id: string | null;
  status: "not_started" | "live" | "paused" | "ended";
};

type Team = {
  id: string;
  name: string;
  is_mock: boolean;
  purse_total: number;
  purse_remaining: number;
  owner_profile_id: string | null;
};

type PlayerDetail = {
  category: string | null;
  base_price: number;
  batting_avg: number | null;
  batting_sr: number | null;
  wickets: number | null;
  economy: number | null;
  players: { full_name: string; primary_role: string | null } | null;
} | null;

type Bid = { id: string; team_id: string; amount: number };

const BID_INCREMENT = 500;

export default function LiveAuction({
  seasonId,
  isAdmin,
  myTeamId,
  teams,
  initialAuctionState,
  initialCurrentPlayer,
}: {
  seasonId: string;
  isAdmin: boolean;
  myTeamId: string | null;
  teams: Team[];
  initialAuctionState: AuctionState;
  initialCurrentPlayer: PlayerDetail;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState(initialAuctionState);
  const [currentPlayer, setCurrentPlayer] = useState(initialCurrentPlayer);
  const [recentBids, setRecentBids] = useState<Bid[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState(myTeamId ?? teams[0]?.id ?? "");
  const [bidAmount, setBidAmount] = useState(
    (initialAuctionState.current_bid_amount ?? 0) + BID_INCREMENT
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const channel = supabase
      .channel(`auction:${seasonId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auction_state",
          filter: `season_id=eq.${seasonId}`,
        },
        async (payload) => {
          const prev = payload.old as AuctionState;
          const next = payload.new as AuctionState;
          setState(next);

          if (next.current_player_id !== prev?.current_player_id) {
            // moved to a different player (or cleared) - reset the bid form
            setRecentBids([]);
            if (next.current_player_id) {
              const { data } = await supabase
                .from("player_season_stats")
                .select("*, players(*)")
                .eq("season_id", seasonId)
                .eq("player_id", next.current_player_id)
                .single();
              setCurrentPlayer(data as PlayerDetail);
              setBidAmount((data as { base_price: number }).base_price + BID_INCREMENT);
            } else {
              setCurrentPlayer(null);
            }
          } else if (next.current_bid_amount != null) {
            // same player, new bid from someone - bump the suggested amount if ours is now too low
            setBidAmount((prevAmount) =>
              prevAmount <= next.current_bid_amount!
                ? next.current_bid_amount! + BID_INCREMENT
                : prevAmount
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bids",
          filter: `season_id=eq.${seasonId}`,
        },
        (payload) => {
          const bid = payload.new as Bid;
          setRecentBids((prev) => [bid, ...prev].slice(0, 5));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, seasonId]);

  const leadingTeam = teams.find((t) => t.id === state.current_leading_team_id);
  const nextMinBid = (state.current_bid_amount ?? 0) + BID_INCREMENT;
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  function submitBid() {
    setError(null);
    startTransition(async () => {
      const result = await placeBid(seasonId, selectedTeamId, bidAmount);
      if (result?.error) setError(result.error);
    });
  }

  if (state.status !== "live") {
    return (
      <p className="text-muted">
        The auction is not live right now (status: {state.status}).
      </p>
    );
  }

  if (!currentPlayer) {
    return <p className="text-muted">Waiting for the next player…</p>;
  }

  return (
    <div className="card">
      <p className="text-sm text-muted">
        Category {currentPlayer.category ?? "—"} · Base price{" "}
        {currentPlayer.base_price}
      </p>
      <h1 className="mt-1 text-2xl font-semibold">
        {currentPlayer.players?.full_name}
      </h1>
      <p className="text-muted">{currentPlayer.players?.primary_role}</p>
      <p className="mt-2 text-sm">
        Bat avg {currentPlayer.batting_avg ?? "—"} · SR{" "}
        {currentPlayer.batting_sr ?? "—"} · Wkts {currentPlayer.wickets ?? "—"} ·
        Econ {currentPlayer.economy ?? "—"}
      </p>

      <p className="mt-4 text-3xl font-bold text-accent">
        {state.current_bid_amount ?? currentPlayer.base_price}
      </p>
      <p className="text-sm text-muted">
        {leadingTeam ? `Leading: ${leadingTeam.name}` : "No bids yet"}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {isAdmin && (
          <select
            className="input max-w-[12rem]"
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="number"
          className="input w-32"
          value={bidAmount}
          min={nextMinBid}
          step={BID_INCREMENT}
          onChange={(e) => setBidAmount(Number(e.target.value))}
        />
        <button
          disabled={pending || !selectedTeamId || bidAmount <= (state.current_bid_amount ?? 0)}
          onClick={submitBid}
          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          Place bid
        </button>
        {selectedTeam && (
          <span className="text-xs text-muted">
            Purse remaining: {selectedTeam.purse_remaining.toLocaleString()}
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {recentBids.length > 0 && (
        <div className="mt-5 border-t border-border pt-3 text-sm">
          <p className="mb-1 text-xs font-medium uppercase text-muted">
            Recent bids
          </p>
          {recentBids.map((b) => (
            <p key={b.id}>
              {teams.find((t) => t.id === b.team_id)?.name ?? "Team"} — {b.amount}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
