"use client";

import { useActionState } from "react";
import Link from "next/link";
import { importPool, type ImportState } from "./actions";

export default function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(
    importPool,
    null
  );

  return (
    <div className="max-w-xl">
      <form action={action} className="card">
        <label className="eyebrow">Auction pool file</label>
        <input
          type="file"
          name="file"
          accept=".xlsx,.xls,.csv"
          required
          className="mt-2 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
        />
        <p className="mt-2 text-xs text-muted">
          Excel (.xlsx) or CSV export from the organizers. Re-importing replaces
          the current pool. Columns are auto-detected.
        </p>
        <button type="submit" disabled={pending} className="btn-primary mt-4">
          {pending ? "Importing…" : "Import & rank"}
        </button>
      </form>

      {state && (
        <div
          className={`card mt-4 ${
            state.ok ? "border-up/40" : "border-down/40"
          }`}
        >
          <p className={state.ok ? "font-medium text-up" : "font-medium text-down"}>
            {state.message}
          </p>

          {state.ok && (
            <Link href="/scout" className="btn-primary mt-3 inline-block">
              View the ranked pool
            </Link>
          )}

          {state.mapping && state.mapping.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-muted">
                Column mapping ({state.mapping.length} matched)
              </summary>
              <ul className="mt-2 space-y-0.5 text-xs text-muted">
                {state.mapping.map((m) => (
                  <li key={m.field}>
                    <span className="font-medium text-foreground">{m.field}</span>{" "}
                    ← {m.header}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {state.warnings && state.warnings.length > 0 && (
            <details className="mt-3 text-sm" open>
              <summary className="cursor-pointer text-muted">
                {state.warnings.length} note(s)
              </summary>
              <ul className="mt-2 space-y-0.5 text-xs text-muted">
                {state.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
