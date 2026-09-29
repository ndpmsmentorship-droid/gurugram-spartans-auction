"use client";

import Image, { type StaticImageData } from "next/image";
import { useCallback, useEffect, useState } from "react";

export type Slide = { src: StaticImageData; caption: string };

// Season 1 award-ceremony photos. Auto-advances every 5s, pauses on hover or
// keyboard focus, and never auto-advances for reduced-motion users.
export default function Season1Gallery({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;
  const go = useCallback((d: number) => setI((v) => (v + d + n) % n), [n]);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => go(1), 5000);
    return () => clearInterval(t);
  }, [paused, go]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Season 1 in pictures"
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[16px] bg-ink sm:aspect-[16/8]">
        {slides.map((s, k) => (
          <div
            key={k}
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{ opacity: k === i ? 1 : 0 }}
            aria-hidden={k !== i}
          >
            <Image
              src={s.src}
              alt={s.caption}
              fill
              sizes="(max-width: 1100px) 100vw, 1100px"
              className="object-cover"
              loading={k === 0 ? "eager" : "lazy"}
            />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/75 to-transparent" />
        <p className="absolute bottom-4 left-5 right-24 font-mono text-[0.688rem] uppercase tracking-[0.16em] text-white/90">
          {slides[i].caption}
        </p>
        <div className="absolute bottom-3 right-3 flex gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Next photo"
          >
            ›
          </button>
        </div>
      </div>
      <div className="mt-3 flex justify-center gap-1.5">
        {slides.map((_, k) => (
          <button
            key={k}
            type="button"
            onClick={() => setI(k)}
            aria-label={`Photo ${k + 1} of ${n}`}
            aria-current={k === i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: k === i ? 22 : 6,
              background: k === i ? "var(--red)" : "var(--line2, rgba(37,2,1,.2))",
            }}
          />
        ))}
      </div>
    </div>
  );
}
