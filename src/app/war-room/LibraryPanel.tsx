"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import cvMap from "@/data/cv-map.json";

const CV = cvMap as Record<string, { batter?: string; bowler?: string }>;
const OPEN_KEY = "wr-library-open";

// The player's CricVideos Ball Library page (clips, spells & phases, pitch map,
// wagon wheel, season stats) shown inside the War Room. The library runs an
// ?embed=1 mode without its own header and posts its height so the frame fits.
// Same-origin only: this works on ndpms.in, where both apps are served.
// Owners sign in to the library once (same username/password as the auction).
export default function LibraryPanel({ name, defaultOpen }: { name: string; defaultOpen?: boolean }) {
  const lib = CV[name];
  const kinds = ([lib?.bowler ? "bowler" : null, lib?.batter ? "batter" : null].filter(Boolean)) as ("bowler" | "batter")[];
  const [kind, setKind] = useState<"bowler" | "batter" | null>(kinds[0] ?? null);
  // remembered per device: once opened, the block card keeps it open for the next player
  const stored = useSyncExternalStore(
    () => () => {},
    () => { try { return localStorage.getItem(OPEN_KEY) === "1"; } catch { return false; } },
    () => false,
  );
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? (!!defaultOpen || stored);
  const [measured, setMeasured] = useState<{ src: string; h: number } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      const h = Number((e.data as { cvEmbedHeight?: number })?.cvEmbedHeight);
      const at = frame.current?.getAttribute("src") ?? "";
      if (h > 200) setMeasured({ src: at, h: Math.min(h, 6000) });
    };
    addEventListener("message", on);
    return () => removeEventListener("message", on);
  }, []);

  if (!lib || !kind) return null;
  const libName = lib[kind]!;
  const src = `/spartans/?p=${kind}-${encodeURIComponent(libName)}&embed=1`;
  const full = `/spartans/?p=${kind}-${encodeURIComponent(libName)}&from=uscl`;
  const height = measured?.src === src ? measured.h : 640;

  function toggle() {
    const next = !open;
    setOverride(next);
    if (!defaultOpen) {
      try { localStorage.setItem(OPEN_KEY, next ? "1" : "0"); } catch {}
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-[12px] border border-line">
      <div className="flex flex-wrap items-center gap-2 bg-wash px-3 py-2">
        <button type="button" onClick={toggle} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold" aria-expanded={open}>
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink text-[0.7rem] text-[#FF7A00]">▶</span>
          <span className="truncate">Ball Library · clips, pitch map &amp; wagon wheel</span>
          <span className="ml-auto text-muted">{open ? "▴" : "▾"}</span>
        </button>
        {open && kinds.length > 1 && (
          <div className="flex gap-1">
            {kinds.map((k) => (
              <button key={k} type="button" className="pill !px-3 !py-1 text-[0.75rem]" data-active={kind === k} onClick={() => setKind(k)}>
                {k === "bowler" ? "Bowling" : "Batting"}
              </button>
            ))}
          </div>
        )}
        {open && (
          <a href={full} target="_blank" rel="noopener noreferrer" className="text-[0.75rem] text-muted underline underline-offset-2 hover:text-ink">
            open full ↗
          </a>
        )}
      </div>
      {open && (
        <iframe
          ref={frame}
          key={src}
          src={src}
          title={`${name} — Ball Library`}
          loading="lazy"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          className="block w-full border-0 bg-white"
          style={{ height }}
        />
      )}
    </div>
  );
}
