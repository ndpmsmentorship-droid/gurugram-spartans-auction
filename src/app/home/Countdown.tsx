"use client";

import { useEffect, useState } from "react";

// Boxed days / hrs / min / sec to a fixed IST moment. Shows dashes until
// mounted so the server and client never disagree about "now".
export default function Countdown({ to, label }: { to: string; label: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const left = now === null ? null : Math.max(0, new Date(to).getTime() - now);
  const units: [string, number][] = [
    ["Days", 864e5],
    ["Hrs", 36e5],
    ["Min", 6e4],
    ["Sec", 1e3],
  ];

  return (
    <div>
      <p className="font-mono text-[0.594rem] uppercase tracking-[0.2em] text-white/60">{label}</p>
      <div className="mt-2 flex gap-2" role="timer" aria-live="off">
        {units.map(([u, ms], i) => {
          const v = left === null ? null : Math.floor((i === 0 ? left : left % units[i - 1][1]) / ms);
          return (
            <div key={u} className="text-center">
              <span className="grid h-14 w-14 place-items-center rounded-[10px] border border-white/15 bg-black/30 font-display text-[1.7rem] leading-none text-white shadow-[inset_0_-2px_0_rgba(177,37,32,0.9)] sm:h-16 sm:w-16 sm:text-[2rem]">
                {v === null ? "––" : String(v).padStart(2, "0")}
              </span>
              <span className="mt-1.5 block font-mono text-[0.531rem] uppercase tracking-[0.16em] text-white/50">{u}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
