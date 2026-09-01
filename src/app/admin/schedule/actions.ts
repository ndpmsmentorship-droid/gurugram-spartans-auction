"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSchedule, type TeamRef } from "@/lib/schedule/generate";
import type { FixtureInsert, FixtureStatus } from "@/lib/supabase/types";

export type ScheduleActionState = { error?: string; ok?: string } | null;

async function assertAdmin(): Promise<boolean> {
  const p = await getCurrentProfile();
  return !!p && p.role === "admin";
}

function refresh() {
  revalidatePath("/admin/schedule");
  revalidatePath("/schedule");
}

/**
 * Build (or rebuild) the whole season's fixture list.
 *
 * Destructive by design: a regenerate wipes this season's fixtures and writes a
 * fresh set, because a partial rebuild would leave match numbers and weekend
 * groupings inconsistent. The UI makes the confirm explicit, and the config is
 * stored alongside so the same inputs reproduce the same schedule.
 */
export async function generateFixtures(
  _prev: ScheduleActionState,
  form: FormData
): Promise<ScheduleActionState> {
  if (!(await assertAdmin())) return { error: "Not authorized." };

  const startDate = String(form.get("startDate") || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate))
    return { error: "Start date must be a valid date." };

  const matchDays = form.getAll("matchDays").map(String).filter(Boolean);
  if (matchDays.length === 0)
    return { error: "Pick at least one match day." };

  const slots = String(form.get("slots") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (slots.length === 0) return { error: "Add at least one time slot." };
  if (slots.some((s) => !/^\d{2}:\d{2}$/.test(s)))
    return { error: "Time slots must be 24-hour HH:MM, comma separated." };

  const blackoutDates = String(form.get("blackoutDates") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (blackoutDates.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d)))
    return { error: "Blackout dates must be YYYY-MM-DD, comma separated." };

  const venue = String(form.get("venue") || "").trim() || "TBD";
  const seed = Number(form.get("seed") || 7);
  if (!Number.isFinite(seed)) return { error: "Seed must be a number." };

  const admin = createAdminClient();

  const { data: season } = await admin
    .from("seasons")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!season) return { error: "No active season." };

  const { data: teamRows } = await admin
    .from("teams")
    .select("id, name, division")
    .eq("season_id", season.id)
    .eq("is_mock", false)
    .order("name");

  const teams: TeamRef[] = (teamRows ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    group: t.division ?? "Unassigned",
  }));

  if (teams.length < 2) return { error: "Need at least two teams." };
  const ungrouped = teams.filter((t) => t.group === "Unassigned");
  if (ungrouped.length)
    return {
      error: `These teams have no group set: ${ungrouped
        .map((t) => t.name)
        .join(", ")}.`,
    };

  const { fixtures, warnings } = generateSchedule(teams, {
    startDate,
    matchDays,
    slots,
    blackoutDates,
    venue,
    seed,
  });

  if (fixtures.length === 0) return { error: "Generator produced no matches." };

  // Replace wholesale — see the note above.
  const { error: delErr } = await admin
    .from("fixtures")
    .delete()
    .eq("season_id", season.id);
  if (delErr) return { error: `Could not clear old fixtures: ${delErr.message}` };

  const rows: FixtureInsert[] = fixtures.map((f) => ({
    season_id: season.id,
    match_no: f.matchNo,
    stage: f.stage,
    round: f.round,
    match_date: f.date,
    day_name: f.dayName,
    slot: f.slot,
    group_name: f.groupName,
    home_team_id: f.homeTeamId,
    away_team_id: f.awayTeamId,
    home_label: f.homeLabel,
    away_label: f.awayLabel,
    venue: f.venue,
    home_score: null,
    away_score: null,
    winner_team_id: null,
    result_note: null,
  }));

  const { error: insErr } = await admin.from("fixtures").insert(rows);
  if (insErr) return { error: `Could not save fixtures: ${insErr.message}` };

  const { error: cfgErr } = await admin.from("schedule_config").upsert(
    {
      season_id: season.id,
      start_date: startDate,
      match_days: matchDays,
      slots,
      blackout_dates: blackoutDates,
      venue,
      seed,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "season_id" }
  );
  if (cfgErr) return { error: `Fixtures saved, but config did not: ${cfgErr.message}` };

  refresh();
  const suffix = warnings.length ? ` Note: ${warnings.join(" ")}` : "";
  return {
    ok: `Generated ${fixtures.length} matches across ${
      new Set(fixtures.map((f) => f.round)).size
    } weekends.${suffix}`,
  };
}

/** Record (or clear) one match result. */
export async function saveResult(
  _prev: ScheduleActionState,
  form: FormData
): Promise<ScheduleActionState> {
  if (!(await assertAdmin())) return { error: "Not authorized." };

  const fixtureId = String(form.get("fixtureId") || "");
  if (!fixtureId) return { error: "Missing fixture." };

  const status = String(form.get("status") || "scheduled") as FixtureStatus;
  if (!["scheduled", "completed", "no_result", "abandoned"].includes(status))
    return { error: "Unknown status." };

  const winnerRaw = String(form.get("winnerTeamId") || "");
  const homeScore = String(form.get("homeScore") || "").trim();
  const awayScore = String(form.get("awayScore") || "").trim();
  const note = String(form.get("resultNote") || "").trim();

  const admin = createAdminClient();

  const { data: fixture } = await admin
    .from("fixtures")
    .select("home_team_id, away_team_id")
    .eq("id", fixtureId)
    .maybeSingle();
  if (!fixture) return { error: "Fixture not found." };

  // A winner has to be one of the two sides — guards against a stale form
  // posting a team from a different match.
  if (
    winnerRaw &&
    winnerRaw !== fixture.home_team_id &&
    winnerRaw !== fixture.away_team_id
  )
    return { error: "Winner must be one of the two teams in this match." };

  // Resetting to 'scheduled' clears the result rather than leaving orphaned
  // scores attached to a match that is no longer marked played.
  const clearing = status === "scheduled";

  const { error } = await admin
    .from("fixtures")
    .update({
      status,
      winner_team_id: clearing || status !== "completed" ? null : winnerRaw || null,
      home_score: clearing ? null : homeScore || null,
      away_score: clearing ? null : awayScore || null,
      result_note: clearing ? null : note || null,
    })
    .eq("id", fixtureId);

  if (error) return { error: error.message };

  refresh();
  return { ok: "Result saved." };
}

/**
 * Wipe the season's fixtures without regenerating. Destructive and
 * unrecoverable, so it only proceeds when the form carries the confirm token
 * the two-step UI adds — a stray POST at this endpoint does nothing.
 */
export async function clearFixtures(
  _prev: ScheduleActionState,
  form: FormData
): Promise<ScheduleActionState> {
  if (!(await assertAdmin())) return { error: "Not authorized." };
  if (String(form.get("confirm")) !== "clear-schedule")
    return { error: "Clearing the schedule needs an explicit confirmation." };

  const admin = createAdminClient();
  const { data: season } = await admin
    .from("seasons")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!season) return { error: "No active season." };

  const { error } = await admin
    .from("fixtures")
    .delete()
    .eq("season_id", season.id);
  if (error) return { error: error.message };

  await admin
    .from("schedule_config")
    .update({ generated_at: null })
    .eq("season_id", season.id);

  refresh();
  return { ok: "Schedule cleared." };
}
