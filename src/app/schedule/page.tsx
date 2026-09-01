import type { Metadata } from "next";
import { loadSchedule } from "@/lib/schedule/data";
import { computeStandings, resolveBracketLabels } from "@/lib/schedule/standings";
import { spreadReport, formatDate, type GeneratedFixture } from "@/lib/schedule/generate";
import ScheduleView, { type SpreadRow } from "./ScheduleView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Match Schedule — Shanti Devi Legend League",
  description:
    "Season 2 fixtures, weekend-by-weekend calendar and points tables for the 12 Shanti Devi Legend League teams.",
};

export default async function SchedulePage() {
  const { seasonName, teams, fixtures, config } = await loadSchedule();

  const standings = computeStandings(fixtures, teams);
  const bracket = resolveBracketLabels(fixtures, standings);

  // The spread report is written against the generator's shape, so map the
  // stored rows back onto it rather than duplicating the counting logic.
  const asGenerated: GeneratedFixture[] = fixtures.map((f) => ({
    matchNo: f.match_no,
    stage: f.stage,
    round: f.round,
    date: f.match_date,
    dayName: f.day_name,
    slot: f.slot,
    groupName: f.group_name,
    homeTeamId: f.home_team_id,
    awayTeamId: f.away_team_id,
    homeLabel: f.home_label,
    awayLabel: f.away_label,
    venue: f.venue ?? "",
  }));

  const logoByTeam = new Map(teams.map((t) => [t.id, t.logoUrl ?? null]));
  const spread: SpreadRow[] = spreadReport(
    asGenerated,
    teams.map((t) => ({ id: t.id, name: t.name, group: t.group })),
    config
  ).map((s) => ({ ...s, logoUrl: logoByTeam.get(s.teamId) ?? null }));

  const groupMatches = fixtures.filter((f) => f.stage === "group");
  const played = groupMatches.filter((f) => f.status !== "scheduled").length;
  const dates = fixtures.map((f) => f.match_date).sort();

  return (
    <>
      <section className="band">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-9 sm:px-7">
          <p
            className="eyebrow"
            style={{ color: "color-mix(in srgb, #fff 65%, transparent)" }}
          >
            {seasonName}
          </p>
          <h1 className="mt-2.5 font-display text-[2rem] text-white sm:text-[2.5rem]">
            Match Schedule
          </h1>
          {fixtures.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              <Stat label="Matches" value={String(fixtures.length)} />
              <Stat label="Teams" value={String(teams.length)} />
              <Stat
                label="Weekends"
                value={String(new Set(fixtures.map((f) => f.round)).size)}
              />
              <Stat
                label="Window"
                value={`${formatDate(dates[0])} → ${formatDate(dates[dates.length - 1])}`}
              />
              <Stat
                label="Played"
                value={`${played} / ${groupMatches.length}`}
              />
              <Stat label="Venue" value={config.venue} />
            </div>
          )}
        </div>
      </section>

      <ScheduleView
        fixtures={fixtures}
        teams={teams}
        standings={[...standings.entries()]}
        spread={spread}
        bracket={[...bracket.entries()]}
        slots={config.slots}
        matchDays={config.matchDays}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="label-mono"
        style={{ color: "color-mix(in srgb, #fff 55%, transparent)" }}
      >
        {label}
      </p>
      <p className="mt-1 font-display text-[1.05rem] text-white">{value}</p>
    </div>
  );
}
