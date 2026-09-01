"use client";

import { useActionState, useState } from "react";
import {
  generateFixtures,
  saveResult,
  clearFixtures,
  type ScheduleActionState,
} from "./actions";
import { formatDate, formatSlot } from "@/lib/schedule/generate";
import type { FixtureRow } from "@/lib/supabase/types";
import type { TeamLite } from "@/lib/schedule/standings";

const ALL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export type ManagerConfig = {
  startDate: string;
  matchDays: string[];
  slots: string[];
  blackoutDates: string[];
  venue: string;
  seed: number;
  generatedAt: string | null;
};

export default function ScheduleManager({
  config,
  fixtures,
  teams,
}: {
  config: ManagerConfig;
  fixtures: FixtureRow[];
  teams: TeamLite[];
}) {
  return (
    <div className="mt-6 flex flex-col gap-8">
      <GeneratorForm config={config} hasFixtures={fixtures.length > 0} />
      {fixtures.length > 0 && <ResultsBoard fixtures={fixtures} teams={teams} />}
    </div>
  );
}

/* -------------------------------------------------------------- generator */

function GeneratorForm({
  config,
  hasFixtures,
}: {
  config: ManagerConfig;
  hasFixtures: boolean;
}) {
  const [state, action, pending] = useActionState<ScheduleActionState, FormData>(
    generateFixtures,
    null
  );
  const [days, setDays] = useState<string[]>(config.matchDays);

  return (
    <section className="card">
      <h2 className="font-display text-[1.125rem]">Generate schedule</h2>
      <p className="mt-1.5 text-[0.813rem] text-muted">
        Single round robin inside each group, one round per weekend, so every
        team plays exactly once a weekend. The generator then spreads each
        team&rsquo;s matches across the time slots and match days as evenly as
        the calendar allows.
      </p>

      {hasFixtures && (
        <p
          className="mt-4 rounded-[10px] px-3.5 py-2.5 text-[0.813rem]"
          style={{
            background: "var(--gold-fill)",
            border: "1px solid var(--gold-line)",
            color: "var(--gold)",
          }}
        >
          A schedule already exists. Regenerating replaces every fixture and
          <strong> discards any results already entered</strong>.
        </p>
      )}

      <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="First match day" hint="The season's opening Saturday.">
          <input
            type="date"
            name="startDate"
            defaultValue={config.startDate}
            className="input"
            required
          />
        </Field>

        <Field label="Venue">
          <input
            type="text"
            name="venue"
            defaultValue={config.venue}
            className="input"
            placeholder="Sportscube, Gurugram"
          />
        </Field>

        <Field
          label="Time slots"
          hint="24-hour HH:MM, comma separated. Three slots = three matches a day."
        >
          <input
            type="text"
            name="slots"
            defaultValue={config.slots.join(", ")}
            className="input"
            placeholder="08:00, 12:00, 16:00"
            required
          />
        </Field>

        <Field
          label="Blackout dates"
          hint="YYYY-MM-DD, comma separated. Any weekend touching one of these is skipped."
        >
          <input
            type="text"
            name="blackoutDates"
            defaultValue={config.blackoutDates.join(", ")}
            className="input"
            placeholder="2027-03-13"
          />
        </Field>

        <Field label="Match days" hint="Which days of the week matches are played on.">
          <div className="flex flex-wrap gap-1.5">
            {ALL_DAYS.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  className="pill"
                  data-active={on}
                  onClick={() =>
                    setDays((cur) =>
                      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]
                    )
                  }
                >
                  {d.slice(0, 3)}
                </button>
              );
            })}
          </div>
          {days.map((d) => (
            <input key={d} type="hidden" name="matchDays" value={d} />
          ))}
        </Field>

        <Field
          label="Seed"
          hint="Same seed + same settings = the same schedule. Change it to shuffle."
        >
          <input
            type="number"
            name="seed"
            defaultValue={config.seed}
            className="input"
          />
        </Field>

        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending
              ? "Generating…"
              : hasFixtures
                ? "Regenerate schedule"
                : "Generate schedule"}
          </button>
          {config.generatedAt && (
            <span className="label-mono">
              Last generated {new Date(config.generatedAt).toLocaleString()}
            </span>
          )}
        </div>

        {state?.error && <Notice kind="error">{state.error}</Notice>}
        {state?.ok && <Notice kind="ok">{state.ok}</Notice>}
      </form>

      {hasFixtures && <ClearButton />}
    </section>
  );
}

function ClearButton() {
  const [state, action, pending] = useActionState<ScheduleActionState, FormData>(
    clearFixtures,
    null
  );
  const [armed, setArmed] = useState(false);

  return (
    <div className="mt-5 border-t border-line pt-4">
      {armed ? (
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="confirm" value="clear-schedule" />
          <span className="text-[0.813rem] text-muted">
            Delete every fixture and result for this season?
          </span>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Clearing…" : "Yes, clear it"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setArmed(false)}
          >
            Cancel
          </button>
          {state?.error && <Notice kind="error">{state.error}</Notice>}
        </form>
      ) : (
        <button
          type="button"
          className="text-[0.75rem] text-muted underline underline-offset-2 hover:text-red"
          onClick={() => setArmed(true)}
        >
          Clear schedule
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- results */

function ResultsBoard({
  fixtures,
  teams,
}: {
  fixtures: FixtureRow[];
  teams: TeamLite[];
}) {
  const [round, setRound] = useState<number>(fixtures[0]?.round ?? 1);
  const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b);
  const nameOf = new Map(teams.map((t) => [t.id, t.name]));
  const shown = fixtures.filter((f) => f.round === round);

  return (
    <section className="card">
      <h2 className="font-display text-[1.125rem]">Results</h2>
      <p className="mt-1.5 text-[0.813rem] text-muted">
        Points tables on the public page are computed from these — nothing is
        stored twice.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {rounds.map((r) => {
          const all = fixtures.filter((f) => f.round === r);
          const done = all.filter((f) => f.status !== "scheduled").length;
          const isFinals = all.every((f) => f.stage !== "group");
          return (
            <button
              key={r}
              type="button"
              className="pill"
              data-active={round === r}
              onClick={() => setRound(r)}
            >
              {isFinals ? "Finals" : `Weekend ${r}`}
              <span className="num text-[0.688rem] opacity-70">
                {done}/{all.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {shown.map((f) => (
          <ResultRow key={f.id} fixture={f} nameOf={nameOf} />
        ))}
      </div>
    </section>
  );
}

function ResultRow({
  fixture: f,
  nameOf,
}: {
  fixture: FixtureRow;
  nameOf: Map<string, string>;
}) {
  const [state, action, pending] = useActionState<ScheduleActionState, FormData>(
    saveResult,
    null
  );
  const [status, setStatus] = useState(f.status);

  const home = f.home_team_id ? nameOf.get(f.home_team_id) : null;
  const away = f.away_team_id ? nameOf.get(f.away_team_id) : null;
  // Knockout slots have no teams until the bracket resolves, so there is
  // nothing to record a winner against yet.
  const locked = !f.home_team_id || !f.away_team_id;

  return (
    <form
      action={action}
      className="tile flex flex-wrap items-center gap-x-3 gap-y-2 p-3"
    >
      <input type="hidden" name="fixtureId" value={f.id} />

      <span className="num w-[30px] shrink-0 text-[0.75rem] text-muted">
        {f.match_no}
      </span>
      <span className="w-[150px] shrink-0 text-[0.75rem] text-muted">
        {formatDate(f.match_date)} &middot; {formatSlot(f.slot)}
      </span>
      <span className="min-w-[240px] flex-1 text-[0.875rem]">
        {home ?? <em className="text-muted">{f.home_label}</em>}
        <span className="mx-1.5 text-faint">v</span>
        {away ?? <em className="text-muted">{f.away_label}</em>}
      </span>

      {locked ? (
        <span className="label-mono">Awaiting group tables</span>
      ) : (
        <>
          <select
            name="status"
            className="input w-auto py-1.5 text-[0.75rem]"
            value={status}
            onChange={(e) => setStatus(e.target.value as FixtureRow["status"])}
          >
            <option value="scheduled">Not played</option>
            <option value="completed">Completed</option>
            <option value="no_result">No result</option>
            <option value="abandoned">Abandoned</option>
          </select>

          {status === "completed" && (
            <>
              <input
                type="text"
                name="homeScore"
                defaultValue={f.home_score ?? ""}
                placeholder="164/6"
                className="input w-[80px] py-1.5 text-[0.75rem]"
              />
              <input
                type="text"
                name="awayScore"
                defaultValue={f.away_score ?? ""}
                placeholder="160/8"
                className="input w-[80px] py-1.5 text-[0.75rem]"
              />
              <select
                name="winnerTeamId"
                defaultValue={f.winner_team_id ?? ""}
                className="input w-auto py-1.5 text-[0.75rem]"
              >
                <option value="">Tied</option>
                <option value={f.home_team_id ?? ""}>{home} won</option>
                <option value={f.away_team_id ?? ""}>{away} won</option>
              </select>
            </>
          )}

          <button type="submit" className="btn-ghost py-1.5" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </>
      )}

      {state?.error && (
        <span className="w-full text-[0.75rem] text-red">{state.error}</span>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ bits */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="label-mono mb-1.5">{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-[0.75rem] text-muted">{hint}</p>}
    </div>
  );
}

function Notice({
  kind,
  children,
}: {
  kind: "ok" | "error";
  children: React.ReactNode;
}) {
  return (
    <p
      className="sm:col-span-2 rounded-[10px] px-3.5 py-2.5 text-[0.813rem]"
      style={
        kind === "ok"
          ? {
              background: "color-mix(in srgb, var(--up) 12%, transparent)",
              color: "var(--up)",
            }
          : {
              background: "color-mix(in srgb, var(--red) 10%, transparent)",
              color: "var(--red-deep)",
            }
      }
    >
      {children}
    </p>
  );
}
