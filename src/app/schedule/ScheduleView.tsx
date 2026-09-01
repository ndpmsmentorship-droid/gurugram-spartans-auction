"use client";

import { useMemo, useState } from "react";
import TeamCrest from "@/app/TeamCrest";
import { formatDate, formatSlot } from "@/lib/schedule/generate";
import type { FixtureRow } from "@/lib/supabase/types";
import type { StandingRow, TeamLite } from "@/lib/schedule/standings";

type Tab = "fixtures" | "weekends" | "standings" | "spread";

export type SpreadRow = {
  teamId: string;
  name: string;
  group: string;
  logoUrl: string | null;
  matches: number;
  distinctSlots: number;
  perSlot: Record<string, number>;
  perDay: Record<string, number>;
};

export default function ScheduleView({
  fixtures,
  teams,
  standings,
  spread,
  bracket,
  slots,
  matchDays,
}: {
  fixtures: FixtureRow[];
  teams: TeamLite[];
  standings: [string, StandingRow[]][];
  spread: SpreadRow[];
  bracket: [string, string][];
  slots: string[];
  matchDays: string[];
}) {
  const [tab, setTab] = useState<Tab>("fixtures");
  const [teamFilter, setTeamFilter] = useState<string>("");

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const bracketMap = useMemo(() => new Map(bracket), [bracket]);

  const visible = useMemo(
    () =>
      teamFilter
        ? fixtures.filter(
            (f) => f.home_team_id === teamFilter || f.away_team_id === teamFilter
          )
        : fixtures,
    [fixtures, teamFilter]
  );

  const side = (id: string | null, label: string | null) => {
    const t = id ? teamById.get(id) : null;
    if (t) return { name: t.name, logoUrl: t.logoUrl ?? null, resolved: true };
    // Knockout slot: show the real team once the group tables decide it.
    const name = label ? bracketMap.get(label) : null;
    const byName = name ? teams.find((x) => x.name === name) : null;
    return {
      name: name ?? label ?? "TBD",
      logoUrl: byName?.logoUrl ?? null,
      resolved: !!name,
    };
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-7">
      {/* controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["fixtures", "All Fixtures"],
              ["weekends", "By Weekend"],
              ["standings", "Points Table"],
              ["spread", "Slot Spread"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="pill"
              data-active={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="label-mono" htmlFor="team-filter">
            Team
          </label>
          <select
            id="team-filter"
            className="input w-auto min-w-[180px] py-2"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <a className="btn-ghost" href="/spartansscout/api/schedule/export">
            Export .xlsx
          </a>
        </div>
      </div>

      {tab === "fixtures" && (
        <FixtureTable rows={visible} side={side} />
      )}

      {tab === "weekends" && <WeekendView rows={visible} side={side} />}

      {tab === "standings" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {standings.map(([group, table]) => (
            <PointsTable key={group} group={group} rows={table} />
          ))}
        </div>
      )}

      {tab === "spread" && (
        <SpreadTable rows={spread} slots={slots} matchDays={matchDays} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

type SideFn = (
  id: string | null,
  label: string | null
) => { name: string; logoUrl: string | null; resolved: boolean };

const STAGE_LABEL: Record<string, string> = {
  semi: "Semi-Final",
  third: "3rd Place",
  final: "Final",
};

function StageBadge({ f }: { f: FixtureRow }) {
  if (f.stage === "group") {
    return (
      <span className="badge border border-line bg-wash text-muted">
        {f.group_name}
      </span>
    );
  }
  return (
    <span
      className="badge"
      style={{
        background: "var(--gold-fill)",
        border: "1px solid var(--gold-line)",
        color: "var(--gold)",
      }}
    >
      {STAGE_LABEL[f.stage] ?? f.stage}
    </span>
  );
}

function Result({ f, side }: { f: FixtureRow; side: SideFn }) {
  if (f.status === "scheduled") return null;
  if (f.status === "no_result" || f.status === "abandoned")
    return (
      <span className="label-mono" style={{ color: "var(--muted)" }}>
        {f.status === "no_result" ? "No result" : "Abandoned"}
      </span>
    );
  const winner = f.winner_team_id ? side(f.winner_team_id, null).name : null;
  return (
    <span className="text-[0.75rem] text-muted">
      {f.home_score && f.away_score ? (
        <span className="num mr-2">
          {f.home_score} &mdash; {f.away_score}
        </span>
      ) : null}
      {winner ? (
        <span className="font-medium text-up">{winner} won</span>
      ) : (
        <span className="font-medium">Tied</span>
      )}
    </span>
  );
}

function FixtureTable({ rows, side }: { rows: FixtureRow[]; side: SideFn }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[760px] border-collapse text-[0.875rem]">
        <thead>
          <tr className="bg-wash">
            {["#", "Date", "Day", "Time", "Stage", "Match", "Result"].map((h) => (
              <th
                key={h}
                className="label-mono px-3 py-2.5 text-left"
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((f, i) => {
            const home = side(f.home_team_id, f.home_label);
            const away = side(f.away_team_id, f.away_label);
            return (
              <tr
                key={f.id}
                style={{
                  background: i % 2 ? "var(--zebra)" : "transparent",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <td className="num px-3 py-2.5 text-muted">{f.match_no}</td>
                <td className="num whitespace-nowrap px-3 py-2.5">
                  {formatDate(f.match_date)}
                </td>
                <td className="px-3 py-2.5 text-muted">{f.day_name}</td>
                <td className="num whitespace-nowrap px-3 py-2.5">
                  {formatSlot(f.slot)}
                </td>
                <td className="px-3 py-2.5">
                  <StageBadge f={f} />
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <TeamCrest name={home.name} logoUrl={home.logoUrl} size={22} />
                    <span className={home.resolved ? "font-medium" : "text-muted italic"}>
                      {home.name}
                    </span>
                    <span className="text-faint">v</span>
                    <TeamCrest name={away.name} logoUrl={away.logoUrl} size={22} />
                    <span className={away.resolved ? "font-medium" : "text-muted italic"}>
                      {away.name}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Result f={f} side={side} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WeekendView({ rows, side }: { rows: FixtureRow[]; side: SideFn }) {
  if (!rows.length) return <Empty />;

  const byRound = new Map<number, FixtureRow[]>();
  for (const f of rows) {
    if (!byRound.has(f.round)) byRound.set(f.round, []);
    byRound.get(f.round)!.push(f);
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {[...byRound.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([round, list]) => {
          const byDay = new Map<string, FixtureRow[]>();
          for (const f of list) {
            const key = `${f.day_name}|${f.match_date}`;
            if (!byDay.has(key)) byDay.set(key, []);
            byDay.get(key)!.push(f);
          }
          const isFinals = list.every((f) => f.stage !== "group");
          return (
            <section key={round} className="card">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-[1.125rem]">
                  {isFinals ? "Finals Weekend" : `Weekend ${round}`}
                </h2>
                <span className="label-mono">{list.length} matches</span>
              </div>
              {[...byDay.entries()].map(([key, dayRows]) => {
                const [dayName, date] = key.split("|");
                return (
                  <div key={key} className="mb-3 last:mb-0">
                    <p className="label-mono mb-1.5" style={{ color: "var(--red)" }}>
                      {dayName} &middot; {formatDate(date)}
                    </p>
                    <ul>
                      {dayRows.map((f) => {
                        const home = side(f.home_team_id, f.home_label);
                        const away = side(f.away_team_id, f.away_label);
                        return (
                          <li
                            key={f.id}
                            className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-[0.813rem]"
                            style={{ borderTop: "1px solid var(--line)" }}
                          >
                            <span className="num w-[68px] shrink-0 text-muted">
                              {formatSlot(f.slot)}
                            </span>
                            <StageBadge f={f} />
                            <span className="flex min-w-0 items-center gap-1.5">
                              <TeamCrest name={home.name} logoUrl={home.logoUrl} size={18} />
                              <span className={home.resolved ? "" : "italic text-muted"}>
                                {home.name}
                              </span>
                              <span className="text-faint">v</span>
                              <TeamCrest name={away.name} logoUrl={away.logoUrl} size={18} />
                              <span className={away.resolved ? "" : "italic text-muted"}>
                                {away.name}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </section>
          );
        })}
    </div>
  );
}

function PointsTable({ group, rows }: { group: string; rows: StandingRow[] }) {
  return (
    <section className="card p-0">
      <div
        className="px-4 py-3"
        style={{
          background: "linear-gradient(180deg,var(--blush-a),var(--blush-b))",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <h2 className="font-display text-[1.05rem]">{group}</h2>
        <p className="label-mono mt-1">Top 2 qualify for the semi-finals</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] border-collapse text-[0.875rem]">
          <thead>
            <tr className="bg-wash">
              {["#", "Team", "P", "W", "L", "T", "NR", "Pts"].map((h) => (
                <th
                  key={h}
                  className="label-mono px-3 py-2 text-left"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.teamId}
                style={{
                  borderBottom: "1px solid var(--line)",
                  background:
                    i < 2
                      ? "color-mix(in srgb, var(--up) 8%, transparent)"
                      : i % 2
                        ? "var(--zebra)"
                        : "transparent",
                }}
              >
                <td className="num px-3 py-2 text-muted">{i + 1}</td>
                <td className="px-3 py-2 font-medium">
                  <span className="flex items-center gap-2">
                    <TeamCrest name={r.name} logoUrl={r.logoUrl} size={20} />
                    {r.name}
                  </span>
                </td>
                <td className="num px-3 py-2">{r.played}</td>
                <td className="num px-3 py-2">{r.won}</td>
                <td className="num px-3 py-2">{r.lost}</td>
                <td className="num px-3 py-2">{r.tied}</td>
                <td className="num px-3 py-2">{r.noResult}</td>
                <td className="num px-3 py-2 font-semibold">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SpreadTable({
  rows,
  slots,
  matchDays,
}: {
  rows: SpreadRow[];
  slots: string[];
  matchDays: string[];
}) {
  if (!rows.length) return <Empty />;
  return (
    <div className="card p-0">
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <h2 className="font-display text-[1.05rem]">Time-slot spread</h2>
        <p className="mt-1 text-[0.813rem] text-muted">
          How evenly each team&rsquo;s matches are distributed. Every team should
          reach all {slots.length} slots, with no slot more than one match ahead
          of another.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[0.875rem]">
          <thead>
            <tr className="bg-wash">
              {["Team", "Group", "M", "Slots used", ...slots.map(formatSlot), ...matchDays].map(
                (h) => (
                  <th
                    key={h}
                    className="label-mono px-3 py-2 text-left"
                    style={{ borderBottom: "1px solid var(--line)" }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.teamId}
                style={{
                  borderBottom: "1px solid var(--line)",
                  background: i % 2 ? "var(--zebra)" : "transparent",
                }}
              >
                <td className="px-3 py-2 font-medium">
                  <span className="flex items-center gap-2">
                    <TeamCrest name={r.name} logoUrl={r.logoUrl} size={20} />
                    {r.name}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted">{r.group}</td>
                <td className="num px-3 py-2">{r.matches}</td>
                <td className="num px-3 py-2">
                  <span
                    className="badge"
                    style={
                      r.distinctSlots === slots.length
                        ? {
                            background: "color-mix(in srgb, var(--up) 14%, transparent)",
                            color: "var(--up)",
                          }
                        : { background: "var(--gold-fill)", color: "var(--gold)" }
                    }
                  >
                    {r.distinctSlots}/{slots.length}
                  </span>
                </td>
                {slots.map((s) => (
                  <td key={s} className="num px-3 py-2">
                    {r.perSlot[s] ?? 0}
                  </td>
                ))}
                {matchDays.map((d) => (
                  <td key={d} className="num px-3 py-2">
                    {r.perDay[d] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="card text-center">
      <p className="text-[0.938rem] text-muted">
        No fixtures yet. An admin can generate the schedule from the Admin
        &rsaquo; Schedule tab.
      </p>
    </div>
  );
}
