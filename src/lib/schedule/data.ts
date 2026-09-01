import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  FixtureRow,
  ScheduleConfigRow,
} from "@/lib/supabase/types";
import { DEFAULT_CONFIG, type ScheduleConfig } from "./generate";
import type { TeamLite } from "./standings";

export type ScheduleBundle = {
  seasonId: string | null;
  seasonName: string;
  teams: TeamLite[];
  fixtures: FixtureRow[];
  config: ScheduleConfig & { generatedAt: string | null };
};

/**
 * Everything both the public schedule page and the admin generator need, in
 * one round trip each.
 *
 * Reads through the service-role client, matching the public `/auction` and
 * `/squad` pages: `seasons` and `teams` are gated to signed-in users by RLS,
 * but the schedule has to render for a signed-out visitor. This is server-only
 * and the team select is narrowed to id/name/division, so no purse figures
 * cross the boundary.
 */
export async function loadSchedule(): Promise<ScheduleBundle> {
  const supabase = createAdminClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  if (!season) {
    return {
      seasonId: null,
      seasonName: "No active season",
      teams: [],
      fixtures: [],
      config: { ...DEFAULT_CONFIG, generatedAt: null },
    };
  }

  const [{ data: teamRows }, { data: fixtureRows }, { data: cfgRow }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, name, division, logo_url")
        .eq("season_id", season.id)
        .eq("is_mock", false)
        .order("division")
        .order("name"),
      supabase
        .from("fixtures")
        .select("*")
        .eq("season_id", season.id)
        .order("match_no"),
      supabase
        .from("schedule_config")
        .select("*")
        .eq("season_id", season.id)
        .maybeSingle(),
    ]);

  const teams: TeamLite[] = (teamRows ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    group: t.division ?? "Unassigned",
    logoUrl: t.logo_url,
  }));

  const cfg = cfgRow as ScheduleConfigRow | null;

  return {
    seasonId: season.id,
    seasonName: season.name,
    teams,
    fixtures: (fixtureRows ?? []) as FixtureRow[],
    config: {
      startDate: cfg?.start_date ?? DEFAULT_CONFIG.startDate,
      matchDays: cfg?.match_days ?? DEFAULT_CONFIG.matchDays,
      slots: cfg?.slots ?? DEFAULT_CONFIG.slots,
      blackoutDates: cfg?.blackout_dates ?? DEFAULT_CONFIG.blackoutDates,
      venue: cfg?.venue ?? DEFAULT_CONFIG.venue,
      seed: cfg?.seed ?? DEFAULT_CONFIG.seed,
      generatedAt: cfg?.generated_at ?? null,
    },
  };
}
