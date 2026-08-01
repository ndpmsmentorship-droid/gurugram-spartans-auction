// Honours infographic: 4 trophies across 5 seasons — 2 champions (gold),
// 2 runners-up (silver).

const GOLD = "#E3A81B";
const GOLD_HI = "#F6CB49";
const SILVER = "#9AA0A6";
const SILVER_HI = "#CDD2D7";

function Trophy({ tone, hi }: { tone: string; hi: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 drop-shadow-sm">
      <path
        d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"
        fill={tone}
        stroke={hi}
        strokeWidth="0.5"
      />
    </svg>
  );
}

export default function HonoursInfographic({ dark = false }: { dark?: boolean }) {
  const label = dark ? "text-white/70" : "text-muted";
  const value = dark ? "text-white" : "text-foreground";

  return (
    <div>
      <div className="flex items-end gap-6">
        <div className="text-center">
          <div className="flex gap-1">
            <Trophy tone={GOLD} hi={GOLD_HI} />
            <Trophy tone={GOLD} hi={GOLD_HI} />
          </div>
          <p className={`mt-1.5 text-xs font-medium ${label}`}>2× Champions</p>
        </div>
        <div className="text-center">
          <div className="flex gap-1">
            <Trophy tone={SILVER} hi={SILVER_HI} />
            <Trophy tone={SILVER} hi={SILVER_HI} />
          </div>
          <p className={`mt-1.5 text-xs font-medium ${label}`}>2× Runners-up</p>
        </div>
      </div>

      <div className="mt-6 flex divide-x divide-white/15">
        {[
          { k: "5", v: "Seasons" },
          { k: "4", v: "Finals" },
          { k: "4", v: "Trophies" },
        ].map((s, i) => (
          <div key={s.v} className={`text-center ${i === 0 ? "pr-6" : "px-6"}`}>
            <p className={`text-2xl font-semibold tracking-tight ${value}`}>{s.k}</p>
            <p className={`text-xs ${label}`}>{s.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
