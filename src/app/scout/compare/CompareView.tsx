"use client";

import { useMemo, useState } from "react";
import Radar, { type RadarSeries } from "../Radar";

export type ComparePlayer = {
  id: string;
  full_name: string;
  primary_role: string | null;
  bat_index: number | null;
  bowl_index: number | null;
  field_index: number | null;
  keep_index: number | null;
  overall_index: number | null;
  bat_avg: number | null;
  bat_sr: number | null;
  runs: number | null;
  wickets: number | null;
  economy: number | null;
  bowl_avg: number | null;
  boundaryPct: number | null;
  finishingRate: number | null;
  wicketsPerMatch: number | null;
};

// colorblind-safe, distinct hues (dataviz skill: categorical, max 3 here)
const COLORS = ["#e07a3e", "#2f7fbf", "#4f9d69"];

type Metric = {
  key: keyof ComparePlayer;
  label: string;
  higherBetter: boolean;
};

const METRICS: Metric[] = [
  { key: "overall_index", label: "Overall index", higherBetter: true },
  { key: "bat_index", label: "Batting index", higherBetter: true },
  { key: "bowl_index", label: "Bowling index", higherBetter: true },
  { key: "field_index", label: "Fielding index", higherBetter: true },
  { key: "bat_avg", label: "Batting avg", higherBetter: true },
  { key: "bat_sr", label: "Strike rate", higherBetter: true },
  { key: "boundaryPct", label: "Boundary %", higherBetter: true },
  { key: "finishingRate", label: "Finishing %", higherBetter: true },
  { key: "runs", label: "Runs", higherBetter: true },
  { key: "wickets", label: "Wickets", higherBetter: true },
  { key: "wicketsPerMatch", label: "Wkts / match", higherBetter: true },
  { key: "economy", label: "Economy", higherBetter: false },
  { key: "bowl_avg", label: "Bowling avg", higherBetter: false },
];

export default function CompareView({ players }: { players: ComparePlayer[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const chosen = useMemo(
    () =>
      selected
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is ComparePlayer => !!p),
    [selected, players]
  );

  const matches = useMemo(() => {
    if (!query) return [];
    return players
      .filter((p) => p.full_name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 6);
  }, [players, query]);

  function add(id: string) {
    if (selected.length >= 3 || selected.includes(id)) return;
    setSelected([...selected, id]);
    setQuery("");
  }

  const series: RadarSeries[] = chosen.map((p, i) => ({
    label: p.full_name,
    color: COLORS[i],
    values: [p.bat_index ?? 0, p.bowl_index ?? 0, p.field_index ?? 0, p.keep_index ?? 0],
  }));

  const round1 = (v: number | null | undefined) =>
    v == null ? null : Math.round(v * 10) / 10;

  function bestIndex(metric: Metric): number | null {
    let best: number | null = null;
    let bestVal: number | null = null;
    chosen.forEach((p, i) => {
      const v = p[metric.key] as number | null;
      if (v == null) return;
      if (
        bestVal == null ||
        (metric.higherBetter ? v > bestVal : v < bestVal)
      ) {
        bestVal = v;
        best = i;
      }
    });
    return best;
  }

  return (
    <div className="mt-5">
      {/* picker */}
      <div className="relative max-w-sm">
        <input
          className="input"
          placeholder="Add a player…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={selected.length >= 3}
        />
        {matches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-[12px] border border-border bg-surface p-1 shadow-sm">
            {matches.map((m) => (
              <button
                key={m.id}
                onClick={() => add(m.id)}
                className="block w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-wash"
              >
                {m.full_name}
                <span className="ml-2 text-xs text-muted">{m.primary_role}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* chips */}
      {chosen.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chosen.map((p, i) => (
            <span
              key={p.id}
              className="badge"
              style={{ backgroundColor: COLORS[i] + "22", color: COLORS[i] }}
            >
              {p.full_name}
              <button
                onClick={() => setSelected(selected.filter((id) => id !== p.id))}
                className="ml-2"
                aria-label={`Remove ${p.full_name}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {chosen.length === 0 ? (
        <p className="mt-10 text-center text-muted">
          Search and add players above to compare.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="card">
            <p className="eyebrow mb-2">Index profiles</p>
            <Radar series={series} />
          </section>

          <section className="card overflow-x-auto">
            <p className="eyebrow mb-2">Metric by metric</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 pr-2">Metric</th>
                  {chosen.map((p, i) => (
                    <th key={p.id} className="py-1 px-2" style={{ color: COLORS[i] }}>
                      {p.full_name.split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((metric) => {
                  const best = bestIndex(metric);
                  return (
                    <tr key={metric.key} className="border-t border-border">
                      <td className="py-1.5 pr-2 text-muted">{metric.label}</td>
                      {chosen.map((p, i) => {
                        const v = round1(p[metric.key] as number | null);
                        return (
                          <td
                            key={p.id}
                            className={`py-1.5 px-2 tabular-nums ${
                              best === i ? "font-semibold text-accent-text" : ""
                            }`}
                          >
                            {v ?? "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
