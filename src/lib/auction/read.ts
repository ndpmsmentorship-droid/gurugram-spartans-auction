import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_FIXTURE } from "@/lib/dev/fake-supabase";
import * as devLot from "@/lib/dev/live-lot";

export type LiveLot = {
  player_id: string | null;
  status: "idle" | "live" | "sold" | "unsold";
  base_price: number | null;
  current_bid: number | null;
  leading_team_id: string | null;
  updated_at: string;
};

const IDLE: LiveLot = {
  player_id: null,
  status: "idle",
  base_price: null,
  current_bid: null,
  leading_team_id: null,
  updated_at: "",
};

/**
 * Current lot for the active season. Returns an idle lot rather than throwing
 * when the phase-2 tables haven't been created yet, so the board keeps working
 * on a database where live_auction_schema.sql hasn't been run.
 */
export async function readLiveLot(seasonId: string | null): Promise<LiveLot> {
  if (DEV_FIXTURE) return devLot.getLot();
  if (!seasonId) return IDLE;

  const sb = createAdminClient() as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await sb
    .from("auction_lot")
    .select("player_id, status, base_price, current_bid, leading_team_id, updated_at")
    .eq("season_id", seasonId)
    .maybeSingle();

  if (error || !data) return IDLE;
  return data as LiveLot;
}
