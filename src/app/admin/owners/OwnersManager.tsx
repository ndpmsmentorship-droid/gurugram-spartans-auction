"use client";

import { useActionState, useState } from "react";
import {
  createOwner,
  resetOwnerPassword,
  removeOwner,
  type OwnerActionState,
} from "./actions";

export type TeamRow = {
  id: string;
  name: string;
  division: string;
  squad: number;
  owner: { id: string; name: string; username: string } | null;
};

const DIVS = ["Elite", "Fighters"];

export default function OwnersManager({ rows }: { rows: TeamRow[] }) {
  const withOwner = rows.filter((r) => r.owner).length;
  return (
    <div className="mt-6">
      <p className="label-mono mb-4">
        {withOwner} of {rows.length} teams have a login
      </p>
      {DIVS.map((div) => {
        const teams = rows.filter((r) => r.division === div);
        if (!teams.length) return null;
        return (
          <section key={div} className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-red">
              {div}
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {teams.map((t) => (
                <TeamOwnerCard key={t.id} team={t} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TeamOwnerCard({ team }: { team: TeamRow }) {
  return (
    <div className="rounded-[12px] border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-[1.05rem] leading-none">{team.name}</p>
          <p className="label-mono mt-1.5">{team.squad} players</p>
        </div>
        {team.owner ? (
          <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--up)_18%,transparent)] px-2 py-0.5 text-[0.7rem] font-semibold text-up">
            Login set
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[0.7rem] text-muted">
            No login
          </span>
        )}
      </div>

      {team.owner ? (
        <OwnerRow team={team} />
      ) : (
        <CreateForm teamId={team.id} />
      )}
    </div>
  );
}

function CreateForm({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState<OwnerActionState, FormData>(
    createOwner,
    null
  );
  return (
    <form action={action} className="mt-3 space-y-2 border-t border-line pt-3">
      <input type="hidden" name="teamId" value={teamId} />
      <Input name="name" placeholder="Owner name" />
      <div className="grid grid-cols-2 gap-2">
        <Input name="username" placeholder="username" mono />
        <Input name="password" placeholder="password" type="text" mono />
      </div>
      {state?.error && <p className="text-xs text-down">{state.error}</p>}
      {state?.ok && <p className="text-xs text-up">{state.ok}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full py-2 text-sm">
        {pending ? "Creating…" : "Create login"}
      </button>
    </form>
  );
}

function OwnerRow({ team }: { team: TeamRow }) {
  const [open, setOpen] = useState<"none" | "reset" | "remove">("none");
  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-sm">
        <span className="text-muted">Owner:</span>{" "}
        <span className="font-medium">{team.owner!.name}</span>{" "}
        <span className="num text-muted">@{team.owner!.username}</span>
      </p>
      <div className="mt-2 flex gap-3 text-xs">
        <button
          onClick={() => setOpen(open === "reset" ? "none" : "reset")}
          className="text-muted underline decoration-dotted hover:text-ink"
        >
          Reset password
        </button>
        <button
          onClick={() => setOpen(open === "remove" ? "none" : "remove")}
          className="text-down underline decoration-dotted hover:opacity-80"
        >
          Remove
        </button>
      </div>
      {open === "reset" && <ResetForm ownerId={team.owner!.id} />}
      {open === "remove" && <RemoveForm teamId={team.id} ownerId={team.owner!.id} />}
    </div>
  );
}

function ResetForm({ ownerId }: { ownerId: string }) {
  const [state, action, pending] = useActionState<OwnerActionState, FormData>(
    resetOwnerPassword,
    null
  );
  return (
    <form action={action} className="mt-2 flex items-center gap-2">
      <input type="hidden" name="ownerId" value={ownerId} />
      <Input name="password" placeholder="new password" type="text" mono />
      <button type="submit" disabled={pending} className="btn-ghost shrink-0 py-2 text-sm">
        {pending ? "…" : "Set"}
      </button>
      {state?.error && <p className="text-xs text-down">{state.error}</p>}
      {state?.ok && <p className="text-xs text-up">{state.ok}</p>}
    </form>
  );
}

function RemoveForm({ teamId, ownerId }: { teamId: string; ownerId: string }) {
  const [state, action, pending] = useActionState<OwnerActionState, FormData>(
    removeOwner,
    null
  );
  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="ownerId" value={ownerId} />
      <p className="text-xs text-muted">Delete this login for good?</p>
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-md border border-down px-3 py-1.5 text-xs font-semibold text-down hover:bg-[color-mix(in_oklab,var(--down)_12%,transparent)]"
      >
        {pending ? "Removing…" : "Yes, remove login"}
      </button>
      {state?.error && <p className="mt-1 text-xs text-down">{state.error}</p>}
    </form>
  );
}

function Input({
  name,
  placeholder,
  type = "text",
  mono,
}: {
  name: string;
  placeholder: string;
  type?: string;
  mono?: boolean;
}) {
  return (
    <input
      name={name}
      type={type}
      placeholder={placeholder}
      required
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      className={`input w-full py-2 text-sm ${mono ? "num" : ""}`}
    />
  );
}
