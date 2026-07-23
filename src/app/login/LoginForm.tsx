"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthActionState } from "./actions";

export default function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [signInState, signInAction, signInPending] = useActionState<
    AuthActionState,
    FormData
  >(signIn, null);
  const [signUpState, signUpAction, signUpPending] = useActionState<
    AuthActionState,
    FormData
  >(signUp, null);

  const state = mode === "in" ? signInState : signUpState;
  const pending = mode === "in" ? signInPending : signUpPending;
  const action = mode === "in" ? signInAction : signUpAction;

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-foreground">
        Gurugram Spartans
      </h1>
      <p className="mt-1 text-sm text-muted">Auction Command Center</p>

      <div className="mt-6 flex gap-1 rounded-lg bg-background p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("in")}
          className={`flex-1 rounded-md py-1.5 transition ${
            mode === "in" ? "bg-surface shadow-sm font-medium" : "text-muted"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("up")}
          className={`flex-1 rounded-md py-1.5 transition ${
            mode === "up" ? "bg-surface shadow-sm font-medium" : "text-muted"
          }`}
        >
          Create account
        </button>
      </div>

      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        {mode === "up" && (
          <Field label="Name">
            <input
              name="display_name"
              required
              className="input"
              placeholder="Team owner name"
            />
          </Field>
        )}
        <Field label="Email">
          <input
            type="email"
            name="email"
            required
            className="input"
            placeholder="you@example.com"
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

        {state?.error && (
          <p className="text-sm text-danger">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground transition disabled:opacity-60"
        >
          {pending ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
      </form>
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
