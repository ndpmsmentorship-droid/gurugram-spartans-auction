import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rankPlayers } from "@/lib/scout/ranks";
import {
  computeAnalytics,
  squadNeeds,
  fitScore,
  type AnalyticsInput,
} from "@/lib/scout/analytics";
import { deriveMetrics, type RawStats } from "@/lib/scout/rankings";
import type { ScoutPlayerRow } from "@/lib/supabase/types";
import PoolBoard, { type PoolPlayer } from "./PoolBoard";

export default async function ScoutPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("scout_players").select("*");

  if (error) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">
        <p className="text-down">Failed to load pool: {error.message}</p>
      </main>
    );
  }

  if (!data || data.length === 0) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">No players yet</h1>
        <p className="mt-2 text-muted">Import the auction pool to get started.</p>
        <Link href="/scout/import" className="btn-primary mt-6 inline-block">
          Import players
        </Link>
      </main>
    );
  }

  const pool = data as ScoutPlayerRow[];
  const ranked = rankPlayers(pool);
  const analytics = computeAnalytics(pool as unknown as AnalyticsInput[]);
  const needs = squadNeeds(
    (pool as unknown as AnalyticsInput[]).filter((p) => p.is_bought)
  );

  const players: PoolPlayer[] = ranked.map((p) => {
    const a = analytics.get(p.id)!;
    const m = deriveMetrics(p as unknown as RawStats);
    return {
      ...p,
      archetype: a.archetype,
      vor: a.vor,
      topRisk: a.riskFlags[0] ?? null,
      boundary_pct: m.boundaryPct == null ? null : Math.round(m.boundaryPct * 10) / 10,
      fit_score:
        Math.round(fitScore(p as unknown as AnalyticsInput, needs) * 10) / 10,
    };
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">The pool</p>
          <h1 className="mt-1 font-display text-2xl font-bold">
            {pool.length} players
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/scout/compare" className="btn-ghost">
            Compare
          </Link>
          <Link href="/scout/import" className="btn-ghost">
            Re-import
          </Link>
        </div>
      </div>
      <PoolBoard players={players} />
    </main>
  );
}
