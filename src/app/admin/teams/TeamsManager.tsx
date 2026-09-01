"use client";

import { useActionState, useState } from "react";
import TeamCrest from "@/app/TeamCrest";
import {
  saveTeam,
  addTeam,
  removeTeam,
  clearLogo,
  type TeamsActionState,
} from "./actions";

export type TeamRow = {
  id: string;
  name: string;
  group: string;
  logoUrl: string | null;
  sourceTeamId: string | null;
  squad: number;
  fixtures: number;
  owner: string | null;
};

/** A team whose archived squad can be borrowed for the prototype. */
export type SourceTeam = { id: string; name: string; squad: number };

export default function TeamsManager({
  teams,
  groups,
  sources,
  staleReasons,
}: {
  teams: TeamRow[];
  groups: string[];
  sources: SourceTeam[];
  staleReasons: string[];
}) {
  const byGroup = new Map<string, TeamRow[]>();
  for (const t of teams) {
    if (!byGroup.has(t.group)) byGroup.set(t.group, []);
    byGroup.get(t.group)!.push(t);
  }

  return (
    <div className="mt-6 flex flex-col gap-7">
      {staleReasons.length > 0 && <StaleBanner reasons={staleReasons} />}

      <p className="text-[0.813rem] text-muted">
        This is the master list. Names and logos saved here appear on the live
        board, schedule, squads, my-team and the owner logins &mdash; nothing is
        typed in twice.
      </p>
      <p className="text-[0.813rem] text-muted">
        <strong className="font-medium text-ink">Squad shown</strong> is a
        prototype control: SDLL players were imported without stats, so a team
        can borrow a SARDA squad to demo against. It only changes what is
        displayed &mdash; the SARDA season itself is never modified.
      </p>

      {[...byGroup.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([group, rows]) => (
          <section key={group}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-red">
              {group} &middot; {rows.length} teams
            </h2>
            <div className="flex flex-col gap-3">
              {rows.map((t) => (
                <TeamCard key={t.id} team={t} groups={groups} sources={sources} />
              ))}
            </div>
          </section>
        ))}

      <AddTeam groups={groups} />
    </div>
  );
}

function StaleBanner({ reasons }: { reasons: string[] }) {
  return (
    <div
      className="rounded-[10px] px-4 py-3"
      style={{
        background: "var(--gold-fill)",
        border: "1px solid var(--gold-line)",
      }}
    >
      <p className="font-display text-[0.95rem]" style={{ color: "var(--gold)" }}>
        The schedule no longer matches these groups
      </p>
      <ul className="mt-2 list-disc pl-5 text-[0.813rem]" style={{ color: "var(--gold)" }}>
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="mt-2 text-[0.813rem]" style={{ color: "var(--gold)" }}>
        Fixtures are unchanged until you rebuild them.{" "}
        <a
          href="/admin/schedule"
          className="underline underline-offset-2 hover:text-red"
        >
          Regenerate the schedule
        </a>
        . Renaming a team or changing its logo never needs this.
      </p>
    </div>
  );
}

function TeamCard({
  team,
  groups,
  sources,
}: {
  team: TeamRow;
  groups: string[];
  sources: SourceTeam[];
}) {
  const [state, action, pending] = useActionState<TeamsActionState, FormData>(
    saveTeam,
    null
  );

  return (
    <div className="rounded-[12px] border border-line bg-surface p-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="teamId" value={team.id} />

        <div className="flex items-center gap-3">
          <TeamCrest name={team.name} logoUrl={team.logoUrl} size={44} />
        </div>

        <label className="min-w-[190px] flex-1">
          <span className="label-mono mb-1.5 block">Team name</span>
          <input
            type="text"
            name="name"
            defaultValue={team.name}
            className="input"
            maxLength={60}
            required
          />
        </label>

        <label>
          <span className="label-mono mb-1.5 block">Group</span>
          <select name="group" defaultValue={team.group} className="input w-auto">
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="label-mono mb-1.5 block">Logo</span>
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="max-w-[210px] text-[0.75rem] text-muted file:mr-2 file:rounded-full file:border file:border-line2 file:bg-surface file:px-3 file:py-1.5 file:text-[0.75rem]"
          />
        </label>

        <label>
          <span className="label-mono mb-1.5 block">Squad shown</span>
          <select
            name="sourceTeamId"
            defaultValue={team.sourceTeamId ?? ""}
            className="input w-auto max-w-[230px]"
          >
            <option value="">Own signings only</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.squad})
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2.5">
        <span className="label-mono">
          {team.squad} player{team.squad === 1 ? "" : "s"}
        </span>
        <span className="label-mono">
          {team.fixtures} fixture{team.fixtures === 1 ? "" : "s"}
        </span>
        <span className="label-mono">
          {team.owner ? `Owner: ${team.owner}` : "No owner login"}
        </span>
        {team.logoUrl && <ClearLogo teamId={team.id} />}
        <RemoveTeam team={team} />
      </div>

      {state?.error && (
        <p className="mt-2 text-[0.75rem] text-red">{state.error}</p>
      )}
      {state?.ok && <p className="mt-2 text-[0.75rem] text-up">{state.ok}</p>}
    </div>
  );
}

function ClearLogo({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState<TeamsActionState, FormData>(
    clearLogo,
    null
  );
  return (
    <form action={action} className="inline">
      <input type="hidden" name="teamId" value={teamId} />
      <button
        type="submit"
        disabled={pending}
        className="text-[0.688rem] text-muted underline underline-offset-2 hover:text-red"
      >
        {pending ? "Removing…" : "Remove logo"}
      </button>
      {state?.error && (
        <span className="ml-2 text-[0.688rem] text-red">{state.error}</span>
      )}
    </form>
  );
}

function RemoveTeam({ team }: { team: TeamRow }) {
  const [state, action, pending] = useActionState<TeamsActionState, FormData>(
    removeTeam,
    null
  );
  const [armed, setArmed] = useState(false);

  // Deleting a team that still has a squad or fixtures would orphan them, so
  // the control is hidden entirely rather than failing after the fact.
  const blocked = team.squad > 0 || team.fixtures > 0;
  if (blocked) return null;

  if (!armed)
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-[0.688rem] text-muted underline underline-offset-2 hover:text-red"
      >
        Remove team
      </button>
    );

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="teamId" value={team.id} />
      <input type="hidden" name="confirm" value="remove-team" />
      <span className="text-[0.688rem] text-muted">Remove {team.name}?</span>
      <button type="submit" disabled={pending} className="text-[0.688rem] text-red underline">
        {pending ? "Removing…" : "Yes"}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="text-[0.688rem] text-muted underline"
      >
        Cancel
      </button>
      {state?.error && (
        <span className="text-[0.688rem] text-red">{state.error}</span>
      )}
    </form>
  );
}

function AddTeam({ groups }: { groups: string[] }) {
  const [state, action, pending] = useActionState<TeamsActionState, FormData>(
    addTeam,
    null
  );
  return (
    <section className="rounded-[12px] border border-dashed border-line2 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-red">
        Add a team
      </h2>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <label className="min-w-[190px] flex-1">
          <span className="label-mono mb-1.5 block">Team name</span>
          <input type="text" name="name" className="input" maxLength={60} required />
        </label>
        <label>
          <span className="label-mono mb-1.5 block">Group</span>
          <select name="group" className="input w-auto" defaultValue={groups[0]}>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-ghost" disabled={pending}>
          {pending ? "Adding…" : "Add team"}
        </button>
      </form>
      <p className="mt-2 text-[0.75rem] text-muted">
        New teams start on a &#8377;3,00,000 purse, matching the rest. Add the
        logo afterwards from its card above.
      </p>
      {state?.error && <p className="mt-2 text-[0.75rem] text-red">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-[0.75rem] text-up">{state.ok}</p>}
    </section>
  );
}
