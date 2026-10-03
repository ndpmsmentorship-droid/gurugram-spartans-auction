"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { readUsclMatch, requestUsclMatch, type MatchState } from "./uscl-match-actions";

const ago = (iso: string | null | undefined, now: number) => {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
};

// Admin: one tap compares our data with the official USCL site (via the checker
// on Nikhil's Mac — see uscl-match-actions.ts) and shows what needs recording.
export default function UsclMatch() {
  const [state, setState] = useState<MatchState | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, start] = useTransition();

  const load = useCallback(async () => {
    const r = await readUsclMatch();
    if ("error" in r) setErr(r.error);
    else setState(r);
    setNow(Date.now());
  }, []);

  const pending = !!state?.requestedAt && state.report?.requestedAt !== state.requestedAt;
  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, pending ? 4000 : 30000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load, pending]);

  const checkerUp = !!state?.checkerSeen && now - Date.parse(state.checkerSeen) < 90000;
  const rep = state?.report;
  const running = pending && rep?.running === state?.requestedAt;

  return (
    <div className="mt-3 border-t border-line pt-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || pending}
          className="pill !border-ink !px-3.5 !py-1.5 font-semibold !text-ink disabled:opacity-60"
          onClick={() =>
            start(async () => {
              setErr(null);
              const r = await requestUsclMatch();
              if (r.error) setErr(r.error);
              await load();
            })
          }
        >
          {pending ? (running ? "Matching with USCL…" : "Waiting for checker…") : "⟳ Match with USCL"}
        </button>
        <span className={`text-xs ${checkerUp ? "text-up" : "text-red"}`}>
          {checkerUp ? "● checker online" : "● checker offline — the Mac running it is off or asleep"}
        </span>
        {rep?.at && !pending && <span className="text-xs text-muted">last match {ago(rep.at, now)}</span>}
      </div>
      {err && <p className="mt-1.5 text-red">{err}</p>}
      {rep?.summary && !pending && (
        <div className="mt-2">
          <button type="button" className="text-left" onClick={() => setOpen((o) => !o)}>
            <span className={`font-medium ${!rep.ok ? "text-red" : rep.summary.startsWith("✓") ? "text-up" : "text-[#9a5b00]"}`}>{rep.summary}</span>
            {rep.text && <span className="ml-2 text-xs text-muted underline underline-offset-2">{open ? "hide details" : "details"}</span>}
          </button>
          {open && rep.text && (
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-[10px] bg-wash p-3 text-[0.75rem] leading-relaxed">{rep.text}</pre>
          )}
        </div>
      )}
    </div>
  );
}
