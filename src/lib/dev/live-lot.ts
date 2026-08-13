/**
 * LOCAL DESIGN FIXTURE — in-memory mirror of the live-auction SQL functions,
 * only reachable when SPARTANS_DEV_FIXTURE=1.
 *
 * It reimplements put_up_lot / place_raise / hammer_lot / pass_lot /
 * undo_last_sale so the whole auctioneer flow can be driven end to end on a
 * laptop with no database. The rule ORDER and the error wording deliberately
 * match supabase/live_auction_schema.sql — if they drift, the console will
 * behave differently here than it does on the night, which is the one thing
 * this file must never do.
 *
 * State is pinned to globalThis so it survives across route bundles and server
 * actions in dev, and resets on restart. That is fine: it is a preview, not a
 * store.
 */

import { fixturePlayers, FIXTURE_TEAMS } from "./fixture";
import { DEFAULT_RULES, isGradeA } from "@/lib/auction/rules";

export type Lot = {
  player_id: string | null;
  status: "idle" | "live" | "sold" | "unsold";
  base_price: number | null;
  current_bid: number | null;
  leading_team_id: string | null;
  updated_at: string;
};

export type Event = {
  id: number;
  player_id: string | null;
  team_id: string | null;
  kind: "put_up" | "raise" | "sell" | "unsold" | "undo";
  amount: number | null;
};

// Pinned to globalThis for the same reason the pool is: Next gives each route
// bundle its own module instance, so a module-level `const lot` means the
// console drives one lot and the board watches a different, permanently idle
// one. One process, one lot.
type Store = { lot: Lot; events: Event[]; seq: number; tick: number };
const g = globalThis as unknown as { __sdllLot?: Store };
g.__sdllLot ??= {
  lot: {
    player_id: null,
    status: "idle",
    base_price: null,
    current_bid: null,
    leading_team_id: null,
    updated_at: "1970-01-01T00:00:00.000Z",
  },
  events: [],
  seq: 0,
  tick: 0,
};
const store = g.__sdllLot;
const lot = store.lot;
const events = store.events;

// A monotonic counter rather than a clock: fixture code must not call Date.now().
const stamp = () =>
  `1970-01-01T00:00:${String(store.tick++ % 60).padStart(2, "0")}.000Z`;

export const getLot = (): Lot => ({ ...lot });
export const getEvents = (): Event[] => events.slice(-40).reverse();

type Row = { id: string; team_id: string | null; sold_price: number | null; acquired: string | null; auction_category: string | null };
const rows = () => fixturePlayers() as unknown as Row[];
const byId = (id: string) => rows().find((p) => p.id === id);

function teamSpend(teamId: string) {
  return rows()
    .filter((p) => p.team_id === teamId)
    .reduce((s, p) => s + (Number(p.sold_price) || 0), 0);
}
function squadSize(teamId: string) {
  return rows().filter((p) => p.team_id === teamId).length;
}

/** Returns an error string, or null on success. Mirrors the SQL check order. */
export function call(fn: string, args: Record<string, unknown>): string | null {
  const r = DEFAULT_RULES;

  if (fn === "put_up_lot") {
    const p = byId(String(args.p_player));
    if (!p) return "Player not found";
    if (p.team_id) return "That player is already sold";
    lot.player_id = p.id;
    lot.status = "live";
    lot.base_price = isGradeA(p.auction_category) ? r.baseGradeA : r.baseGradeB;
    lot.current_bid = null;
    lot.leading_team_id = null;
    lot.updated_at = stamp();
    events.push({ id: ++store.seq, player_id: p.id, team_id: null, kind: "put_up", amount: lot.base_price });
    return null;
  }

  if (fn === "place_raise") {
    if (lot.status !== "live" || !lot.player_id) return "No lot is live";
    const teamId = String(args.p_team);
    const amount = Number(args.p_amount);
    if (amount > r.maxBid) return `Bid ${amount} is over the ${r.maxBid} ceiling`;
    if (lot.current_bid == null) {
      if (amount < (lot.base_price ?? 0))
        return `Opening bid must be at least the ${lot.base_price} base price`;
    } else if (amount < lot.current_bid + r.minIncrement) {
      return `Raise must be at least ${r.minIncrement} above the current bid`;
    }
    if (lot.leading_team_id === teamId) return "That team is already the highest bidder";

    const team = FIXTURE_TEAMS.find((t) => t.id === teamId);
    if (!team) return "Team not found";
    const spent = teamSpend(teamId);
    if (spent + amount > team.purse_total)
      return `Over purse: ${spent} spent + ${amount} exceeds ${team.purse_total}`;
    if (squadSize(teamId) >= r.squadMax) return `Squad is already full (${r.squadMax})`;

    lot.current_bid = amount;
    lot.leading_team_id = teamId;
    lot.updated_at = stamp();
    events.push({ id: ++store.seq, player_id: lot.player_id, team_id: teamId, kind: "raise", amount });
    return null;
  }

  if (fn === "hammer_lot") {
    if (lot.status !== "live") return "No lot is live";
    if (!lot.leading_team_id || lot.current_bid == null)
      return "No bids on this lot — mark it unsold instead";
    const p = byId(lot.player_id!);
    if (p) {
      p.team_id = lot.leading_team_id;
      p.sold_price = lot.current_bid;
      p.acquired = "auction";
    }
    events.push({
      id: ++store.seq,
      player_id: lot.player_id,
      team_id: lot.leading_team_id,
      kind: "sell",
      amount: lot.current_bid,
    });
    lot.status = "sold";
    lot.updated_at = stamp();
    return null;
  }

  if (fn === "pass_lot") {
    if (lot.status !== "live") return "No lot is live";
    events.push({ id: ++store.seq, player_id: lot.player_id, team_id: null, kind: "unsold", amount: null });
    lot.status = "unsold";
    lot.updated_at = stamp();
    return null;
  }

  if (fn === "undo_last_sale") {
    const sale = [...events].reverse().find((e) => e.kind === "sell");
    if (!sale) return "No sale to undo";
    const undone = events.some((e) => e.kind === "undo" && e.player_id === sale.player_id && e.id > sale.id);
    if (undone) return "That sale has already been undone";
    const p = byId(sale.player_id!);
    if (p) {
      p.team_id = null;
      p.sold_price = null;
      p.acquired = null;
    }
    events.push({ id: ++store.seq, player_id: sale.player_id, team_id: sale.team_id, kind: "undo", amount: sale.amount });
    lot.updated_at = stamp();
    return null;
  }

  return `Unknown function ${fn}`;
}
