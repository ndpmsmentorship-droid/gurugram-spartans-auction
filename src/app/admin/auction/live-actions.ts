"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { getAuctionSeasonId } from "@/lib/auction/target";
import { DEV_FIXTURE } from "@/lib/dev/fake-supabase";
import * as devLot from "@/lib/dev/live-lot";

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

async function call(fn: string, args: Record<string, unknown>): Promise<Result> {
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

  revalidatePath("/admin/auction");
  revalidatePath("/auction");
  revalidatePath("/squad");
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

/** Sell to the leading team. */
export async function hammerLot(): Promise<Result> {
  return call("hammer_lot", {});
}

/** No bids / withdrawn — the player goes back to the pool. */
export async function passLot(): Promise<Result> {
  return call("pass_lot", {});
}

/** Reverse the most recent sale. */
export async function undoLastSale(): Promise<Result> {
  return call("undo_last_sale", {});
}
