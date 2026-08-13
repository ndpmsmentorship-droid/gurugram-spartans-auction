// Self-contained inline-SVG radar for the four sub-indices (0-100). Supports
// overlaying multiple players (used on the compare page). No external deps.

export type RadarSeries = {
  label: string;
  values: (number | null)[]; // aligned to `axes`
  color: string;
};

const AXES = ["Batting", "Bowling", "Fielding", "Keeping"];

export default function Radar({
  series,
  size = 240,
  axes = AXES,
}: {
  series: RadarSeries[];
  size?: number;
  axes?: string[];
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const count = axes.length;

  const pointAt = (axisIndex: number, value: number) => {
    const angle = (Math.PI * 2 * axisIndex) / count - Math.PI / 2;
    const rad = (value / 100) * r;
    return [cx + rad * Math.cos(angle), cy + rad * Math.sin(angle)] as const;
  };

  const rings = [25, 50, 75, 100];

  // Side labels ("BOWLING", "KEEPING") are wider than the plot, so the viewBox
  // is padded horizontally — otherwise they get clipped at the edge.
  const padX = 52;

  return (
    <svg
      viewBox={`${-padX} 0 ${size + padX * 2} ${size}`}
      className="mx-auto h-auto w-full max-w-[340px]"
      role="img"
      aria-label="Player index radar"
    >
      {/* grid rings */}
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={axes
            .map((_, i) => pointAt(i, ring).join(","))
            .join(" ")}
          fill="none"
          stroke="var(--line)"
          strokeWidth={1}
        />
      ))}
      {/* spokes + labels */}
      {axes.map((label, i) => {
        const [x, y] = pointAt(i, 100);
        const [lx, ly] = pointAt(i, 116);
        // anchor away from the plot so side labels never overlap the rings
        const cos = Math.cos((Math.PI * 2 * i) / count - Math.PI / 2);
        const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
        return (
          <g key={label}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth={1} />
            <text
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={9.5}
              letterSpacing="0.12em"
              fontFamily="var(--font-mono)"
              fill="var(--faint)"
            >
              {label.toUpperCase()}
            </text>
          </g>
        );
      })}
      {/* series polygons */}
      {series.map((s) => {
        const pts = axes
          .map((_, i) => pointAt(i, s.values[i] ?? 0).join(","))
          .join(" ");
        return (
          <g key={s.label}>
            <polygon
              points={pts}
              fill={s.color}
              fillOpacity={0.18}
              stroke={s.color}
              strokeWidth={2}
            />
            {axes.map((_, i) => {
              const [px, py] = pointAt(i, s.values[i] ?? 0);
              return <circle key={i} cx={px} cy={py} r={2.5} fill={s.color} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}
