"use client";

import { useActionState } from "react";
import { changePassword, type PwState } from "./actions";

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState<PwState, FormData>(changePassword, null);
  return (
    <div className="card w-full max-w-sm p-8">
      <h1 className="font-display text-xl font-bold text-foreground">Set your password</h1>
      <p className="mt-1 text-sm text-muted">
        This is your first sign-in. Choose your own password to open the owners&apos; portal. You&apos;ll use it from now on.
      </p>
      <form action={action} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">New password</span>
          <input type="password" name="password" required minLength={8} autoComplete="new-password" className="input" placeholder="at least 8 characters" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Type it again</span>
          <input type="password" name="confirm" required minLength={8} autoComplete="new-password" className="input" />
        </label>
        {state?.error && <p className="text-sm text-down">{state.error}</p>}
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </div>
  );
}
