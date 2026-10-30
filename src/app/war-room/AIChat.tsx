"use client";

import { useEffect, useRef, useState } from "react";

// The War Room's AI scout: a floating chat that suggests the best player to go
// for. Each question carries a fresh snapshot of the War Room (see
// /api/ai-chat). Until the Claude API key is set it says it goes live on
// auction day.
type Turn = { role: "user" | "assistant"; content: string };

const ASK = [
  "Who is the best player for us right now?",
  "Should we bid on the player on the block? Up to how much?",
  "Which gap in our squad should we fill next?",
  "Best value pick within our max safe bid?",
];

export default function AIChat({ snapshot }: { snapshot: () => string }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [turns, open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: q }];
    setTurns([...next, { role: "assistant", content: "" }]);
    setDraft("");
    setBusy(true);
    const put = (content: string) => setTurns([...next, { role: "assistant", content }]);
    try {
      const res = await fetch("/spartansscout/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, snapshot: snapshot() }),
      });
      if (res.status === 503) {
        setOffline(true);
        put("The AI scout goes live on auction day. Until then, the suggestions panel in the War Room shows the best fits for your squad.");
        return;
      }
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        put(j?.error ?? "The AI scout couldn't answer just now. Try again.");
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        put(acc);
      }
      if (!acc.trim()) put("No answer came back. Try again.");
    } catch {
      put("Connection dropped. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-red px-4 py-3 font-display text-sm uppercase tracking-wide text-white shadow-[var(--elev)] transition hover:-translate-y-0.5"
        aria-expanded={open}
      >
        <span aria-hidden>✦</span> {open ? "Close" : "AI scout"}
      </button>

      {open && (
        <section
          className="fixed bottom-20 right-4 z-40 flex max-h-[min(640px,calc(100dvh-7rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[16px] border border-line bg-surface shadow-[var(--elev)]"
          aria-label="AI scout"
        >
          <header className="border-b border-line px-4 py-3">
            <p className="font-display text-base uppercase leading-tight">AI scout</p>
            <p className="text-[0.75rem] text-muted">
              {offline ? "Goes live on auction day" : "Ask who to buy. It reads your purse, slots, gaps and the player on the block."}
            </p>
          </header>

          <div ref={list} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {turns.length === 0 && (
              <div className="space-y-2">
                {ASK.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => send(a)}
                    className="block w-full rounded-[12px] border border-line px-3 py-2 text-left text-sm hover:border-red hover:text-red"
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
            {turns.map((t, i) => (
              <div
                key={i}
                className={
                  t.role === "user"
                    ? "ml-8 rounded-[12px] bg-red px-3 py-2 text-sm text-white"
                    : "mr-4 whitespace-pre-wrap rounded-[12px] bg-wash px-3 py-2 text-sm leading-relaxed"
                }
              >
                {t.content || (busy && i === turns.length - 1 ? <span className="text-muted">Thinking…</span> : null)}
              </div>
            ))}
          </div>

          <form
            className="flex gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Who should we bid on next?"
              className="min-w-0 flex-1 rounded-full border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-red"
              disabled={busy}
            />
            <button type="submit" disabled={busy || !draft.trim()} className="rounded-full bg-ink px-4 py-2 text-sm text-white disabled:opacity-40">
              Ask
            </button>
          </form>
        </section>
      )}
    </>
  );
}
