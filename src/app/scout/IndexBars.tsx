// Four sub-index mini-bars. One hue family only — the brand red ramp — so the
// bars read as a single measure at four positions, not four categories. The
// same rail treatment carries the team purse meters on the live board.

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
          <div key={key} className="flex items-center gap-2.5">
            <span className="label-mono w-8 shrink-0">{label}</span>
            <div className="rail flex-1">
              <span style={{ width: `${v == null ? 0 : Math.max(2, v)}%` }} />
            </div>
            <span className="num w-7 shrink-0 text-right text-[0.625rem] text-muted">
              {v == null ? "—" : Math.round(v)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
