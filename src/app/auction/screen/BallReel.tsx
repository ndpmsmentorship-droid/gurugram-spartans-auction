"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReelBall } from "@/app/auction/reel/route";

// The player's Ball Library highlights, played on the hall screen while he is
// on the block: wickets and sixes first, each ball ~3 s before release to
// ~4.5 s after, muted. Alternates with the player card (CARD_MS) so the room
// sees his stats and his cricket. Players without clips just keep the card.
const CARD_MS = 8000;

type YTPlayer = {
  loadVideoById: (o: { videoId: string; startSeconds: number; endSeconds: number }) => void;
  destroy: () => void;
};
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, o: object) => YTPlayer; PlayerState: { ENDED: number } };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytReady: Promise<void> | null = null;
function loadYT() {
  if (window.YT?.Player) return Promise.resolve();
  ytReady ??= new Promise((res) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      res();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return ytReady;
}

function useReel(name: string | undefined) {
  const [balls, setBalls] = useState<ReelBall[]>([]);
  useEffect(() => {
    if (!name) return;
    let alive = true;
    fetch(`/spartansscout/auction/reel?name=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((j) => alive && setBalls(j.balls ?? []))
      .catch(() => {});
    return () => {
      alive = false;
      setBalls([]);
    };
  }, [name]);
  return balls;
}

// The on-block panel: the card for CARD_MS, then the reel, then back again.
export function CardThenReel({ name, card }: { name: string; card: React.ReactNode }) {
  const balls = useReel(name);
  const [reel, setReel] = useState(false);
  useEffect(() => {
    if (!balls.length || reel) return;
    const id = setTimeout(() => setReel(true), CARD_MS);
    return () => clearTimeout(id);
  }, [balls.length, reel]);
  const back = useCallback(() => setReel(false), []);
  return reel && balls.length ? <BallReel balls={balls} name={name} onEnd={back} /> : card;
}

export default function BallReel({ balls, name, onEnd }: { balls: ReelBall[]; name: string; onEnd: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const player = useRef<YTPlayer | null>(null);
  const idx = useRef(0);

  useEffect(() => {
    let dead = false;
    let guard: ReturnType<typeof setTimeout>;
    const play = (n: number) => {
      if (n >= balls.length) return onEnd();
      idx.current = n;
      setI(n);
      const b = balls[n];
      player.current?.loadVideoById({ videoId: b.yt, startSeconds: b.s, endSeconds: b.e });
      // A clip that never fires ENDED (blocked embed, slow load) must not stall the screen.
      clearTimeout(guard);
      guard = setTimeout(() => play(idx.current + 1), (b.e - b.s + 6) * 1000);
    };
    loadYT().then(() => {
      if (dead || !host.current || !window.YT) return;
      const el = document.createElement("div");
      host.current.appendChild(el);
      player.current = new window.YT.Player(el, {
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, mute: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1, iv_load_policy: 3 },
        events: {
          onReady: (e: { target: { mute: () => void } }) => {
            e.target.mute();
            play(0);
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === window.YT!.PlayerState.ENDED) play(idx.current + 1);
          },
        },
      });
    });
    return () => {
      dead = true;
      clearTimeout(guard);
      player.current?.destroy();
      player.current = null;
    };
  }, [balls, onEnd]);

  const b = balls[i];
  return (
    <div className="bs-in absolute inset-0 bg-black">
      <div ref={host} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-[1.2vw] pb-[2vw] pt-[0.9vw]">
        <span className="rounded-full bg-[#e8352b] px-[0.8vw] py-[0.3vw] font-mono text-[0.75vw] font-bold uppercase tracking-[0.18em] text-white">
          ▶ Ball Library
        </span>
        <span className="font-mono text-[0.8vw] tracking-[0.12em] text-white/70">
          {i + 1} / {balls.length}
        </span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-[1.2vw] pb-[1vw] pt-[3vw]">
        <p className="font-display text-[2.6vw] font-bold uppercase leading-none">{name}</p>
        {b && (
          <p className="mt-[0.4vw] font-mono text-[0.95vw] uppercase tracking-[0.12em] text-white/80">
            <b className={b.what === "Wicket" ? "text-[#FF3B30]" : b.what === "Six" || b.what === "Four" ? "text-[#FFD27A]" : ""}>{b.what}</b>
            {b.vs ? ` · vs ${b.vs}` : ""}
            {b.comp ? ` · ${b.comp}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
