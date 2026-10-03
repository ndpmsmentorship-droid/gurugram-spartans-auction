"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { getAuctionSeasonId } from "@/lib/auction/target";
import { DEV_FIXTURE } from "@/lib/dev/fake-supabase";
import * as devLot from "@/lib/dev/live-lot";
import { liveBids } from "@/lib/auction/board-data";

type Result = { error?: string };

/**
 * Every mutation here is auctioneer-only. The database functions enforce the
 * money rules a second time (SECURITY DEFINER) — this check is about WHO, the
 * SQL is about WHAT. Neither is sufficient alone.
 */
async function requireAdmin(): Promise<Result | null> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { error: "Auctioneer access only." };
  return null;
}

// The auction is driven off the SCCL Elite/Fighters season, not the (nominal)
// active SDLL season — see lib/auction/target.ts.
async function activeSeasonId(): Promise<string | null> {
  return getAuctionSeasonId();
}

// Postgres RAISE messages arrive wrapped; surface just the sentence so the
// console can show "Over purse — ₹12,000 left" rather than a stack of noise.
function clean(message: string | undefined): string {
  if (!message) return "Something went wrong.";
  return message.replace(/^.*?(?:ERROR|error):\s*/i, "").split("\n")[0].trim();
}

async function call(fn: string, args: Record<string, unknown>, revalidate = true): Promise<Result> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const season = await activeSeasonId();
  if (!season) return { error: "No active season." };

  if (DEV_FIXTURE) {
    const err = devLot.call(fn, { p_season: season, ...args });
    if (err) return { error: err };
  } else {
    const sb = createAdminClient();
    const { error } = await sb.rpc(fn as never, { p_season: season, ...args } as never);
    if (error) return { error: clean(error.message) };
  }

  if (revalidate) {
    revalidatePath("/admin/auction");
    revalidatePath("/auction");
    revalidatePath("/squad");
  }
  return {};
}

/** Open a player for bidding. */
export async function putUpLot(playerId: string): Promise<Result> {
  return call("put_up_lot", { p_player: playerId });
}

/** Record a team's raise. Purse / squad / ceiling are checked in the database. */
export async function placeRaise(teamId: string, amount: number): Promise<Result> {
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a bid amount." };
  return call("place_raise", { p_team: teamId, p_amount: Math.round(amount) });
}

/**
 * The operator pad's one-tap raise. Same database checks as placeRaise, but no
 * page revalidation: the pad already shows the bid optimistically, and every
 * other screen follows auction_lot over realtime — re-rendering the pad after
 * each tap would only slow the next one down.
 */
export async function quickRaise(teamId: string, amount: number): Promise<Result> {
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a bid amount." };
  return call("place_raise", { p_team: teamId, p_amount: Math.round(amount) }, false);
}

/**
 * Take back the last bid on the live lot — the fix for a mis-tapped team.
 * Logged as an 'undo' with a NEGATIVE amount, which the screens read as "bid
 * withdrawn" and which can never be mistaken for a reversed sale.
 */
export async function takeBackBid(): Promise<Result> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (DEV_FIXTURE) {
    const err = devLot.call("take_back_bid", {});
    return err ? { error: err } : {};
  }
  const season = await activeSeasonId();
  if (!season) return { error: "No active season." };

  const sb = createAdminClient() as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: lot } = await sb.from("auction_lot").select("*").eq("season_id", season).maybeSingle();
  if (!lot || lot.status !== "live" || !lot.player_id) return { error: "No lot is live." };

  const { data: evs } = await sb
    .from("auction_event")
    .select("id, kind, player_id, team_id, amount")
    .eq("season_id", season)
    .eq("player_id", lot.player_id)
    .order("id", { ascending: true });
  const list = (evs ?? []) as { kind: string; team_id: string | null; amount: number | null }[];
  let start = -1;
  list.forEach((e, i) => {
    if (e.kind === "put_up") start = i;
  });
  const bids = liveBids(list.slice(start + 1));
  const last = bids.pop();
  if (!last) return { error: "No bid to take back." };
  const prev = bids[bids.length - 1];

  // only if nobody has bid since we read it
  const { data: moved, error } = await sb
    .from("auction_lot")
    .update({ current_bid: prev?.amount ?? null, leading_team_id: prev?.team_id ?? null, updated_at: new Date().toISOString() })
    .eq("season_id", season)
    .eq("status", "live")
    .eq("current_bid", last.amount)
    .eq("leading_team_id", last.team_id)
    .select("season_id");
  if (error) return { error: clean(error.message) };
  if (!moved?.length) return { error: "The bid changed meanwhile — try again." };

  await sb.from("auction_event").insert({
    season_id: season,
    player_id: lot.player_id,
    team_id: last.team_id,
    kind: "undo",
    amount: -last.amount,
  });
  return {};
}

/** Sell to the leading team. */
export async function hammerLot(): Promise<Result> {
  return call("hammer_lot", {});
}

/** No bids — records the player as UNSOLD. A verdict, and it sticks. */
export async function passLot(): Promise<Result> {
  return call("pass_lot", {});
}

/**
 * Take the lot off the block with no verdict, to auction later. Unlike
 * passLot() this records nothing against the player — he simply returns to the
 * pool and can be put up again.
 */
export async function withdrawLot(): Promise<Result> {
  return call("withdraw_lot", {});
}

/** Reverse the most recent sale. */
export async function undoLastSale(): Promise<Result> {
  return call("undo_last_sale", {});
}
