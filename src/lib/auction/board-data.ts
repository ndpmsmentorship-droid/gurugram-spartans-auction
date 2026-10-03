import "server-only";
import type { StaticImageData } from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { readLiveLot, type LiveLot } from "./read";
import { getAuctionSeasonId, AUCTION_DIVISIONS } from "./target";
import { normCategory } from "@/lib/scout/tier";
import { findFranchise } from "@/app/franchises";
import type { LotPlayerDetail } from "@/app/auction/PlayerIdentity";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Everything the big screen (/auction/screen) and the operator pad
// (/admin/auction/pad) show, read in one go. Both screens render the SAME
// numbers, so they share this loader rather than each computing purses and
// queues their own way.

export type ScreenPlayer = LotPlayerDetail & {
  batting_style: string | null;
  bowling_style: string | null;
};

export type ScreenTeam = {
  id: string;
  name: string;
  logo: StaticImageData | string | null;
  purse_total: number;
  spent: number;
  squadSize: number;
  catCounts: Record<string, number>;
};

export type QueuePlayer = {
  id: string;
  full_name: string;
  auction_category: string | null;
  primary_role: string | null;
  overall_rank: number | null;
};

export type Sale = {
  id: number;
  pid: string;
  player: string;
  category: string | null;
  team_id: string | null;
  amount: number;
};

export type Bid = { team_id: string; amount: number };

export type BoardData = {
  lot: LiveLot;
  lotNo: number;
  player: ScreenPlayer | null;
  bids: Bid[];
  teams: ScreenTeam[];
  upNext: QueuePlayer[];
  /** everyone still available, in auction order — the pad's search draws from it */
  available: QueuePlayer[];
  recent: Sale[];
  sold: number;
  unsold: number;
  squadMax: number;
};

// Auction order: the room sells A+ first, then A, B, Special — within a
// category, our best-ranked player first. The operator can put anyone up out
// of order from search; this is only the default "next".
const CAT_ORDER: Record<string, number> = { "A+": 0, A: 1, B: 2, Special: 3 };

const PLAYER_COLS =
  "id, full_name, auction_category, primary_role, overall_index, is_marquee, photo_url, age, " +
  "bat_matches, runs, bat_avg, bat_sr, wickets, economy, bat_index, bowl_index, batting_style, bowling_style";

/**
 * Walk the lot's events in order: a raise pushes a bid, an 'undo' while the
 * lot is live is a bid taken back (operator mis-tap) and pops one. Shared by
 * the screen's bid ladder and takeBackBid().
 */
export function liveBids(events: { kind: string; team_id: string | null; amount: number | null }[]): Bid[] {
  const out: Bid[] = [];
  for (const e of events) {
    if (e.kind === "raise" && e.team_id) out.push({ team_id: e.team_id, amount: Number(e.amount) });
    else if (e.kind === "undo") out.pop();
  }
  return out;
}

// PostgREST hands back at most 1,000 rows a request; the pool is bigger.
async function allPlayers(sb: { from: (t: string) => any }) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("scout_players")
      .select("id, full_name, auction_category, primary_role, overall_index, team_id, sold_price, is_rejected")
      .order("id")
      .range(from, from + 999);
    if (error || !data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return { data: out };
}

export async function loadBoard(opts: { queue?: number } = {}): Promise<BoardData | null> {
  const seasonId = await getAuctionSeasonId();
  if (!seasonId) return null;
  const sb = createAdminClient() as unknown as { from: (t: string) => any };

  const [lot, { data: teams }, { data: pool }, { data: events }, { data: rules }] = await Promise.all([
    readLiveLot(seasonId),
    sb
      .from("teams")
      .select("id, name, logo_url, purse_total")
      .eq("season_id", seasonId)
      .in("division", AUCTION_DIVISIONS)
      .order("name"),
    // the whole pool, light columns only — ranks, purses and the queue all come from it
    allPlayers(sb),
    sb
      .from("auction_event")
      .select("id, kind, player_id, team_id, amount")
      .eq("season_id", seasonId)
      .order("id", { ascending: true }),
    sb.from("auction_rules").select("squad_max").eq("season_id", seasonId).maybeSingle(),
  ]);

  const players = (pool ?? []) as any[];
  const evs = (events ?? []) as any[];

  // rank = position by overall index, same as the live board
  const rank = new Map<string, number>();
  players
    .filter((p) => p.overall_index != null)
    .sort((a, b) => b.overall_index - a.overall_index)
    .forEach((p, i) => rank.set(p.id, i + 1));

  // ---- purses ----
  const spent = new Map<string, number>();
  const size = new Map<string, number>();
  const cats = new Map<string, Record<string, number>>();
  for (const p of players) {
    if (!p.team_id) continue;
    spent.set(p.team_id, (spent.get(p.team_id) ?? 0) + (Number(p.sold_price) || 0));
    size.set(p.team_id, (size.get(p.team_id) ?? 0) + 1);
    const c = normCategory(p.auction_category);
    if (c) {
      const m = cats.get(p.team_id) ?? {};
      m[c] = (m[c] ?? 0) + 1;
      cats.set(p.team_id, m);
    }
  }
  const screenTeams: ScreenTeam[] = ((teams ?? []) as any[]).map((t) => ({
    id: t.id,
    name: t.name,
    logo: t.logo_url ?? findFranchise(t.name)?.logo ?? null,
    purse_total: Number(t.purse_total) || 0,
    spent: spent.get(t.id) ?? 0,
    squadSize: size.get(t.id) ?? 0,
    catCounts: cats.get(t.id) ?? {},
  }));

  // ---- the event log: sales, unsold verdicts, lot number ----
  const name = new Map(players.map((p) => [p.id, p]));
  const sales: Sale[] = [];
  const unsoldIds = new Set<string>();
  let lotNo = 0;
  for (const e of evs) {
    if (e.kind === "put_up") {
      lotNo += 1;
      unsoldIds.delete(e.player_id);
    } else if (e.kind === "sell") {
      const p = name.get(e.player_id);
      sales.push({
        id: e.id,
        pid: e.player_id,
        player: p?.full_name ?? "—",
        category: p?.auction_category ?? null,
        team_id: e.team_id,
        amount: Number(e.amount) || 0,
      });
    } else if (e.kind === "undo") {
      // a reversed sale (undo_last_sale) — drop it from the sales list
      // (a bid taken back is logged with a negative amount, so it never matches)
      for (let i = sales.length - 1; i >= 0; i--) {
        if (sales[i].pid === e.player_id && sales[i].amount === Number(e.amount)) {
          sales.splice(i, 1);
          break;
        }
      }
    } else if (e.kind === "unsold") {
      unsoldIds.add(e.player_id);
    }
  }

  // ---- the lot on the block ----
  let player: ScreenPlayer | null = null;
  let bids: Bid[] = [];
  if (lot.player_id) {
    const { data: lp } = await sb.from("scout_players").select(PLAYER_COLS).eq("id", lot.player_id).maybeSingle();
    if (lp) player = { ...(lp as any), overall_rank: rank.get(lot.player_id) ?? null };
    let start = -1;
    evs.forEach((e, i) => {
      if (e.kind === "put_up" && e.player_id === lot.player_id) start = i;
    });
    if (start >= 0) bids = liveBids(evs.slice(start + 1).filter((e) => e.player_id === lot.player_id));
  }

  // ---- the queue ----
  const toQueue = (p: any): QueuePlayer => ({
    id: p.id,
    full_name: p.full_name,
    auction_category: p.auction_category,
    primary_role: p.primary_role,
    overall_rank: rank.get(p.id) ?? null,
  });
  const available = players
    .filter((p) => !p.team_id && !p.is_rejected && p.id !== lot.player_id)
    .sort(
      (a, b) =>
        (CAT_ORDER[normCategory(a.auction_category) ?? "B"] ?? 9) - (CAT_ORDER[normCategory(b.auction_category) ?? "B"] ?? 9) ||
        (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9) ||
        a.full_name.localeCompare(b.full_name)
    )
    .map(toQueue);
  const upNext = available.filter((p) => !unsoldIds.has(p.id)).slice(0, opts.queue ?? 5);

  return {
    lot,
    lotNo,
    player,
    bids,
    teams: screenTeams,
    upNext,
    available,
    recent: sales.slice(-8).reverse(),
    sold: sales.length,
    unsold: unsoldIds.size,
    squadMax: rules?.squad_max ?? 25,
  };
}
