"use client";

import { useActionState } from "react";
import { signIn, type AuthActionState } from "./actions";

// Login-only. Accounts are created by an admin (no public sign-up), so a few
// trusted people can get in and nobody else.
export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    signIn,
    null
  );

  return (
    <div className="card w-full max-w-sm p-8">
      <h1 className="font-display text-xl font-bold text-foreground">
        Spartans Scout
      </h1>
      <p className="mt-1 text-sm text-muted">Auction-day command</p>

      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Username or email">
          <input
            type="text"
            name="email"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="input"
            placeholder="your username"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            name="password"
            required
            minLength={6}
            className="input"
            placeholder="••••••••"
          />
        </Field>

        {state?.error && <p className="text-sm text-down">{state.error}</p>}

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Please wait…" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-xs text-muted">
        Access is invite-only. Ask the admin to set you up.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
