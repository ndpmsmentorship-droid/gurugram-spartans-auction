// Four sub-index mini-bars. Colors follow a consistent scale (dataviz skill:
// one hue family, sufficient contrast, labeled) — orange = the brand accent for
// the dominant skill, neutral track behind each.

const BARS: { key: "bat" | "bowl" | "field" | "keep"; label: string }[] = [
  { key: "bat", label: "BAT" },
  { key: "bowl", label: "BOWL" },
  { key: "field", label: "FLD" },
  { key: "keep", label: "WK" },
];

export default function IndexBars({
  bat,
  bowl,
  field,
  keep,
}: {
  bat: number | null;
  bowl: number | null;
  field: number | null;
  keep: number | null;
}) {
  const values = { bat, bowl, field, keep };

  return (
    <div className="space-y-1.5">
      {BARS.map(({ key, label }) => {
        const v = values[key];
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="w-8 shrink-0 font-mono text-[10px] text-muted">
              {label}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${v == null ? 0 : Math.max(2, v)}%` }}
              />
            </div>
            <span className="w-7 shrink-0 text-right text-[10px] tabular-nums text-muted">
              {v == null ? "—" : Math.round(v)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
