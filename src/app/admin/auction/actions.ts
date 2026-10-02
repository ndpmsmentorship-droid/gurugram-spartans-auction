"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { DEFAULT_RULES } from "@/lib/auction/rules";
import { RTM_FRANCHISES, RTM_MAX_AGAINST } from "@/lib/auction/rtm";

// The auction is admin-run: the admin records each purchase (player -> team @ price)
// on the live scout_players pool. team_id / sold_price / acquired are set here;
// the public board reads them. is_bought/bought_price (the squad planner) is untouched.

type Result = { error?: string; ok?: boolean };

/* eslint-disable @typescript-eslint/no-explicit-any */
// The generated Database type doesn't include the new scout_players columns yet,
// so use a loose client for reads/writes that touch them (regenerate types later).
type LooseClient = { from: (t: string) => any };

async function ensureAdmin(): Promise<Result | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return { error: "Admins only." };
  return null;
}

// Recording sales (and undoing them, and RTMs) — admins only. Nikhil runs the
// War Room auction pad on the admin login; every USCL franchise now has an
// owner login (soft launch), so owners must never be able to record.
async function ensureRecorder(): Promise<Result | null> {
  const profile = await getCurrentProfile();
  if (profile?.role === "admin") return null;
  return { error: "Admins only." };
}

function revalidate() {
  revalidatePath("/admin/auction");
  revalidatePath("/auction");
  revalidatePath("/");
}

// Sum already committed to a team (optionally excluding one player, for re-assigns).
async function teamSpent(sb: LooseClient, teamId: string, exceptPlayerId?: string) {
  const { data } = await sb.from("scout_players").select("id, sold_price").eq("team_id", teamId);
  return (data ?? []).reduce(
    (s: number, r: { id: string; sold_price: number | null }) =>
      s + (r.id === exceptPlayerId ? 0 : Number(r.sold_price) || 0),
    0,
  );
}

export async function assignPlayer(
  playerId: string,
  teamId: string,
  price: number,
  acquired: "auction" | "owner" | "retained" = "auction",
): Promise<Result> {
  const denied = await ensureRecorder();
  if (denied) return denied;
  if (!playerId || !teamId) return { error: "Pick a player and a team." };
  const amount = Math.round(Number(price));
  if (!Number.isFinite(amount) || amount < 0) return { error: "Enter a valid price." };
  // Ceiling from the active league's rules (SDLL ₹4,00,000 · USCL ₹3,00,000).
  if (amount > DEFAULT_RULES.maxBid)
    return { error: `Max bid is ₹${DEFAULT_RULES.maxBid.toLocaleString("en-IN")}.` };

  const supabase = createAdminClient();
  const sb = supabase as unknown as LooseClient;

  const { data: team } = await supabase.from("teams").select("name, purse_total").eq("id", teamId).single();
  if (!team) return { error: "Team not found." };

  const spent = await teamSpent(sb, teamId, playerId);
  const remaining = Number(team.purse_total) - spent;
  if (amount > remaining) {
    return {
      error: `Over budget — ${team.name} has ₹${remaining.toLocaleString("en-IN")} left. Extend the purse first.`,
    };
  }

  const { error } = await sb
    .from("scout_players")
    .update({ team_id: teamId, sold_price: amount, acquired: ["owner", "retained"].includes(acquired) ? acquired : "auction" })
    .eq("id", playerId);
  if (error) return { error: error.message };

  revalidate();
  return { ok: true };
}

// USCL Right to Match, after the hammer: the player was sold to the winning
// team (at its revised bid, if it revised). `rtmTeamId` matched, so he moves to
// them at `price`. Enforces one RTM per existing franchise and at most two
// against any single team.
export async function rtmPlayer(playerId: string, rtmTeamId: string, price: number): Promise<Result> {
  const denied = await ensureRecorder();
  if (denied) return denied;
  const amount = Math.round(Number(price));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the matched price." };
  if (amount > DEFAULT_RULES.maxBid) return { error: `Max bid is ₹${DEFAULT_RULES.maxBid.toLocaleString("en-IN")}.` };

  const supabase = createAdminClient();
  const sb = supabase as unknown as LooseClient;
  const [{ data: player }, { data: rtmTeam }] = await Promise.all([
    sb.from("scout_players").select("full_name, team_id, acquired").eq("id", playerId).single(),
    sb.from("teams").select("name, purse_total").eq("id", rtmTeamId).single(),
  ]);
  if (!player || !rtmTeam) return { error: "Player or team not found." };
  if (!RTM_FRANCHISES.includes(rtmTeam.name)) return { error: `${rtmTeam.name} isn't an existing franchise — no RTM.` };
  if (!player.team_id || player.acquired !== "auction") return { error: `${player.full_name} isn't an auction sale — sell him first.` };
  if (player.team_id === rtmTeamId) return { error: `${player.full_name} is already with ${rtmTeam.name}.` };

  const { data: rtms } = await sb.from("scout_players").select("full_name, team_id, rtm_against").eq("acquired", "rtm");
  const used = (rtms ?? []).find((r: { team_id: string }) => r.team_id === rtmTeamId);
  if (used) return { error: `${rtmTeam.name} already used its RTM (on ${used.full_name}).` };
  const against = (rtms ?? []).filter((r: { rtm_against: string }) => r.rtm_against === player.team_id).length;
  if (against >= RTM_MAX_AGAINST) return { error: `Already ${RTM_MAX_AGAINST} RTMs against that team — no more allowed.` };

  const remaining = Number(rtmTeam.purse_total) - (await teamSpent(sb, rtmTeamId));
  if (amount > remaining) return { error: `${rtmTeam.name} has only ₹${remaining.toLocaleString("en-IN")} left.` };

  const { error } = await sb
    .from("scout_players")
    .update({ team_id: rtmTeamId, sold_price: amount, acquired: "rtm", rtm_against: player.team_id })
    .eq("id", playerId)
    .eq("team_id", player.team_id);
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}

export async function unassignPlayer(playerId: string): Promise<Result> {
  const denied = await ensureRecorder();
  if (denied) return denied;
  const supabase = createAdminClient();
  const sb = supabase as unknown as LooseClient;
  const { error } = await sb
    .from("scout_players")
    .update({ team_id: null, sold_price: null, acquired: null, rtm_against: null })
    .eq("id", playerId);
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}

// Raise a team's spendable purse (₹2L base) up to its ceiling (₹3.5L max).
export async function setPurse(teamId: string, newTotal: number): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return denied;
  const amount = Math.round(Number(newTotal));
  const supabase = createAdminClient();
  const sb = supabase as unknown as LooseClient;

  const { data: team } = await sb.from("teams").select("purse_max").eq("id", teamId).single();
  if (!team) return { error: "Team not found." };
  const ceiling = Number(team.purse_max) || amount;
  if (amount > ceiling) return { error: `Max purse is ₹${ceiling.toLocaleString("en-IN")}.` };

  const spent = await teamSpent(sb, teamId);
  if (amount < spent) return { error: `Team has already spent ₹${spent.toLocaleString("en-IN")}.` };

  const { error } = await supabase
    .from("teams")
    .update({ purse_total: amount, purse_remaining: amount - spent })
    .eq("id", teamId);
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}
