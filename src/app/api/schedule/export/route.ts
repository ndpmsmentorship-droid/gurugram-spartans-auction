import * as XLSX from "xlsx";
import { loadSchedule } from "@/lib/schedule/data";
import { computeStandings } from "@/lib/schedule/standings";
import {
  spreadReport,
  formatDate,
  formatSlot,
  type GeneratedFixture,
} from "@/lib/schedule/generate";

export const dynamic = "force-dynamic";

/**
 * Download the whole schedule as a workbook, laid out to match the sheet
 * structure the league already circulates (README / Fixtures / Weekend View /
 * Points tables / Time-Slot Spread) so it drops straight into existing habits.
 */
export async function GET() {
  const { seasonName, teams, fixtures, config } = await loadSchedule();

  if (fixtures.length === 0) {
    return new Response("No schedule has been generated yet.", {
      status: 404,
      headers: { "content-type": "text/plain" },
    });
  }

  const nameOf = new Map(teams.map((t) => [t.id, t.name]));
  const side = (id: string | null, label: string | null) =>
    (id ? nameOf.get(id) : null) ?? label ?? "TBD";

  const groupMatches = fixtures.filter((f) => f.stage === "group");
  const weekends = new Set(fixtures.map((f) => f.round)).size;
  const stageName: Record<string, string> = {
    group: "Group",
    semi: "Semi-Final",
    third: "3rd Place Playoff",
    final: "Final",
  };

  const wb = XLSX.utils.book_new();

  /* ---- README ---------------------------------------------------------- */
  const groups = [...new Set(teams.map((t) => t.group))].sort();
  const readme = [
    [seasonName.toUpperCase() + " — MATCH SCHEDULE"],
    [],
    ["FORMAT"],
    [
      `${teams.length} teams in ${groups.length} groups (${groups.join(", ")}).`,
    ],
    [
      "Group stage: single round robin — every team plays every other team in its own group once.",
    ],
    [`That's ${groupMatches.length} group-stage matches.`],
    [],
    ["QUALIFICATION"],
    ["Top 2 from each group advance to the semi-finals; winners meet in the final."],
    [],
    ["RULES APPLIED"],
    [`• Matches only on ${config.matchDays.join(" and ")}.`],
    ["• No team plays twice in the same weekend — structural, one round per weekend."],
    [
      `• Each team's matches are spread across the ${config.slots.length} time slots ` +
        `(${config.slots.map(formatSlot).join(" / ")}) as evenly as possible.`,
    ],
    ["• Single venue — there is no home/away designation."],
    [],
    [`Tournament start: ${formatDate(config.startDate)}.`],
    [`Venue: ${config.venue}.`],
    [`Group stage runs ${weekends - 1} weekends, then the finals weekend.`],
    config.blackoutDates.length
      ? [`Blackout dates skipped: ${config.blackoutDates.join(", ")}.`]
      : ["No blackout dates."],
    [],
    ["WHAT'S STILL A PLACEHOLDER"],
    [
      "Knockout matchups depend on final group standings. The bracket structure, dates and",
    ],
    [
      "time slots are fixed — team names fill in automatically once every group result is in.",
    ],
    [],
    ["SHEETS IN THIS FILE"],
    ["• Fixtures — every match with date/day/time"],
    ["• Weekend View — the same fixtures grouped by weekend, for a printable sheet"],
    ...groups.map((g) => [`• Points — ${g} — standings, live as results are entered`]),
    ["• Team Time-Slot Spread — how evenly each team is distributed across slots"],
  ].map((r) => (Array.isArray(r) ? r : [r]));
  const wsReadme = XLSX.utils.aoa_to_sheet(readme);
  wsReadme["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsReadme, "README");

  /* ---- Fixtures -------------------------------------------------------- */
  const fixtureRows = [
    [
      "Match #",
      "Weekend",
      "Date",
      "Day",
      "Time",
      "Stage",
      "Group",
      // Not "Home"/"Away": every match is at the one venue, so these are
      // simply the two sides, in the order they're listed.
      "Team 1",
      "Team 2",
      "Venue",
      "Status",
      "Result",
    ],
    ...fixtures.map((f) => [
      f.match_no,
      f.round,
      formatDate(f.match_date),
      f.day_name,
      formatSlot(f.slot),
      stageName[f.stage] ?? f.stage,
      f.group_name ?? "",
      side(f.home_team_id, f.home_label),
      side(f.away_team_id, f.away_label),
      f.venue ?? config.venue,
      f.status === "scheduled" ? "" : f.status.replace("_", " "),
      f.status === "completed"
        ? f.winner_team_id
          ? `${nameOf.get(f.winner_team_id) ?? "?"} won` +
            (f.home_score && f.away_score
              ? ` (${f.home_score} v ${f.away_score})`
              : "")
          : "Tied"
        : "",
    ]),
  ];
  const wsFixtures = XLSX.utils.aoa_to_sheet(fixtureRows);
  wsFixtures["!cols"] = [
    { wch: 9 }, { wch: 9 }, { wch: 13 }, { wch: 10 }, { wch: 10 },
    { wch: 17 }, { wch: 10 }, { wch: 24 }, { wch: 24 }, { wch: 22 },
    { wch: 12 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsFixtures, "Fixtures");

  /* ---- Weekend View ---------------------------------------------------- */
  const weekendRows: (string | number)[][] = [
    [`${seasonName.toUpperCase()} — WEEK BY WEEK`],
    [],
  ];
  const byRound = new Map<number, typeof fixtures>();
  for (const f of fixtures) {
    if (!byRound.has(f.round)) byRound.set(f.round, []);
    byRound.get(f.round)!.push(f);
  }
  for (const [round, list] of [...byRound.entries()].sort((a, b) => a[0] - b[0])) {
    const isFinals = list.every((f) => f.stage !== "group");
    weekendRows.push([isFinals ? "FINALS WEEKEND" : `WEEKEND ${round}`]);
    const byDay = new Map<string, typeof list>();
    for (const f of list) {
      const key = `${f.day_name}|${f.match_date}`;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(f);
    }
    for (const [key, dayRows] of byDay) {
      const [dayName, date] = key.split("|");
      weekendRows.push([dayName, formatDate(date)]);
      for (const f of dayRows) {
        weekendRows.push([
          formatSlot(f.slot),
          f.group_name ?? stageName[f.stage] ?? "",
          side(f.home_team_id, f.home_label),
          "vs",
          side(f.away_team_id, f.away_label),
        ]);
      }
    }
    weekendRows.push([]);
  }
  const wsWeekend = XLSX.utils.aoa_to_sheet(weekendRows);
  wsWeekend["!cols"] = [
    { wch: 14 }, { wch: 18 }, { wch: 24 }, { wch: 5 }, { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsWeekend, "Weekend View");

  /* ---- Points tables --------------------------------------------------- */
  const standings = computeStandings(fixtures, teams);
  for (const [group, table] of standings) {
    const rows = [
      ["Pos", "Team", "Played", "Won", "Lost", "Tied", "No Result", "Points", "Qualifies?"],
      ...table.map((r, i) => [
        i + 1,
        r.name,
        r.played,
        r.won,
        r.lost,
        r.tied,
        r.noResult,
        r.points,
        i < 2 ? "Top 2 qualify" : "",
      ]),
      [],
      [
        "Points: win 2 · tie 1 · no result 1 · loss 0. Standings recompute from entered results — nothing is typed in twice.",
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 6 }, { wch: 24 }, { wch: 8 }, { wch: 7 }, { wch: 7 },
      { wch: 7 }, { wch: 11 }, { wch: 8 }, { wch: 16 },
    ];
    // Sheet names cap at 31 chars.
    XLSX.utils.book_append_sheet(wb, ws, `Points — ${group}`.slice(0, 31));
  }

  /* ---- Team Time-Slot Spread ------------------------------------------- */
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
  const spread = spreadReport(
    asGenerated,
    teams.map((t) => ({ id: t.id, name: t.name, group: t.group })),
    config
  );
  const spreadRows = [
    [
      "Team",
      "Group",
      "Matches",
      "Distinct Time Slots Used",
      ...config.slots.map(formatSlot),
      ...config.matchDays,
    ],
    ...spread.map((s) => [
      s.name,
      s.group,
      s.matches,
      s.distinctSlots,
      ...config.slots.map((slot) => s.perSlot[slot] ?? 0),
      ...config.matchDays.map((d) => s.perDay[d] ?? 0),
    ]),
  ];
  const wsSpread = XLSX.utils.aoa_to_sheet(spreadRows);
  wsSpread["!cols"] = [
    { wch: 24 }, { wch: 10 }, { wch: 9 }, { wch: 24 },
    ...config.slots.map(() => ({ wch: 10 })),
    ...config.matchDays.map(() => ({ wch: 10 })),
  ];
  XLSX.utils.book_append_sheet(wb, wsSpread, "Team Time-Slot Spread");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
  const filename = `SDLL_S2_Match_Schedule.xlsx`;

  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
