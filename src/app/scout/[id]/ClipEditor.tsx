"use client";

import { useState, useTransition } from "react";
import { setScoutingClip } from "@/app/scout/actions";

export default function ClipEditor({
  playerId,
  clipUrl,
  note,
}: {
  playerId: string;
  clipUrl: string | null;
  note: string | null;
}) {
  const [url, setUrl] = useState(clipUrl ?? "");
  const [text, setText] = useState(note ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await setScoutingClip(
        playerId,
        url.trim() || null,
        text.trim() || null
      );
      setMsg(res.error ? res.error : "Saved.");
    });
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs text-muted">
          Clip link (YouTube / Drive / any URL)
        </span>
        <input
          className="input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
      </label>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-accent-text hover:underline"
        >
          Open clip ↗
        </a>
      )}
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Scouting note</span>
        <textarea
          className="input min-h-[80px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What to watch for — technique, shot range, pace, temperament…"
        />
      </label>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save clip & note"}
        </button>
        {msg && (
          <span className={msg === "Saved." ? "text-sm text-up" : "text-sm text-down"}>
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
