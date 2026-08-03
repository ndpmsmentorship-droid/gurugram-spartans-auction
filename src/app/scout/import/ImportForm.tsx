"use client";

import { useActionState } from "react";
import Link from "next/link";
import { importPool, syncFromLeague, type ImportState } from "./actions";

function ResultCard({ state }: { state: NonNullable<ImportState> }) {
  return (
    <div className={`card mt-4 ${state.ok ? "border-up/40" : "border-down/40"}`}>
      <p className={state.ok ? "font-medium text-up" : "font-medium text-down"}>{state.message}</p>

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
                <span className="font-medium text-foreground">{m.field}</span> ← {m.header}
              </li>
            ))}
          </ul>
        </details>
      )}

      {state.warnings && state.warnings.length > 0 && (
        <details className="mt-3 text-sm" open>
          <summary className="cursor-pointer text-muted">{state.warnings.length} note(s)</summary>
          <ul className="mt-2 space-y-0.5 text-xs text-muted">
            {state.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function ImportForm() {
  const [syncState, syncAction, syncing] = useActionState<ImportState, FormData>(
    syncFromLeague,
    null
  );
  const [state, action, pending] = useActionState<ImportState, FormData>(importPool, null);

  return (
    <div className="max-w-xl">
      {/* one-click live sync from the league site */}
      <form
        action={syncAction}
        className="card"
        style={{ borderTop: "3px solid #E0453A", borderRadius: "18px" }}
      >
        <label className="eyebrow" style={{ color: "#D2691E" }}>
          Live sync
        </label>
        <p className="mt-1 font-display text-lg font-semibold">Pull the pool from SCCL</p>
        <p className="mt-1 text-sm text-muted">
          Fetches every current registration straight from the anantanity dashboard and rebuilds the
          ranked pool. No spreadsheet needed. Replaces the current pool.
        </p>
        <button
          type="submit"
          disabled={syncing}
          className="mt-4 rounded-full px-5 py-2 text-[0.95rem] font-semibold text-white transition disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #FF8A3D 0%, #E0453A 100%)" }}
        >
          {syncing ? "Syncing from SCCL…" : "⟳ Auto-import from SCCL"}
        </button>
      </form>

      {syncState && <ResultCard state={syncState} />}

      <p className="mt-6 mb-2 text-xs uppercase tracking-wide text-muted">or upload a file</p>

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
          Excel (.xlsx) or CSV export from the organizers. Re-importing replaces the current pool.
          Columns are auto-detected.
        </p>
        <button type="submit" disabled={pending} className="btn-primary mt-4">
          {pending ? "Importing…" : "Import & rank"}
        </button>
      </form>

      {state && <ResultCard state={state} />}
    </div>
  );
}
