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
import { resolveCategory } from "@/lib/scout/category";
import type { ScoutPlayerRow } from "@/lib/supabase/types";
import PoolBoard, { type PoolPlayer } from "./PoolBoard";

const r1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);

// Ordinal rank (1 = best) over a single metric, among players that have a value.
// dir "high" = bigger is better; "low" = smaller is better (e.g. runs conceded).
function rankMetric(
  items: { id: string }[],
  val: (p: { id: string }) => number | null,
  dir: "high" | "low"
): Map<string, number> {
  const withVal = items
    .filter((p) => val(p) != null)
    .sort((a, b) => (dir === "high" ? val(b)! - val(a)! : val(a)! - val(b)!));
  const m = new Map<string, number>();
  withVal.forEach((p, i) => m.set(p.id, i + 1));
  return m;
}

export default async function ScoutPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("scout_players").select("*");

  if (error) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Pool temporarily unavailable</h1>
        <p className="mt-2 text-muted">
          The database didn&rsquo;t respond just now (a brief hiccup). Please refresh in a moment.
        </p>
        <a href="/scout" className="btn-primary mt-6 inline-block">
          Retry
        </a>
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
    const cat = resolveCategory(p);
    // Sortable advanced metrics, each gated on a real career sample so the
    // ranked/sorted top is always well-founded (median in this pool is ~216
    // overs / ~273 innings, so these floors keep the bulk while cutting the
    // thin-sample tail). Below the floor the value is blank, not just uncoloured.
    const MIN_OVERS = 50; // ≈ 300 balls bowled
    const MIN_INNINGS = 20; // batting innings
    const MIN_MATCHES = 20; // matches played (fielding)
    const bowlOk = (p.overs ?? 0) >= MIN_OVERS;
    const batOk = (p.bat_innings ?? 0) >= MIN_INNINGS;
    const matches = Math.max(p.bat_matches ?? 0, p.bowl_matches ?? 0);
    const hasField = p.catches != null || p.run_outs != null;
    const field_ratio =
      matches >= MIN_MATCHES && hasField
        ? r2(((p.catches ?? 0) + (p.run_outs ?? 0)) / matches)
        : null;
    return {
      ...p,
      sold: (p as unknown as { team_id: string | null }).team_id != null,
      archetype: a.archetype,
      vor: a.vor,
      topRisk: a.riskFlags[0] ?? null,
      hasRecentForm: a.hasRecentForm,
      boundary_pct: batOk ? r1(m.boundaryPct) : null,
      dot_pct: bowlOk ? r1(m.dotBallPct) : null,
      bowl_boundary_pct: bowlOk ? r1(m.boundaryConcededPct) : null,
      field_ratio,
      bnd_rank: 9999,
      dot_pct_rank: 9999,
      bowl_bnd_rank: 9999,
      field_ratio_rank: 9999,
      fit_score:
        Math.round(fitScore(p as unknown as AnalyticsInput, needs) * 10) / 10,
      category: cat.category,
      categoryIsOverride: cat.isOverride,
    };
  });

  // Per-metric ranks (1 = best) drive the top-10/11–30 colour code. Values are
  // already sample-gated above, so ranking only the non-null keeps the top
  // well-founded.
  const bndRank = rankMetric(players, (p) => (p as PoolPlayer).boundary_pct, "high");
  const dotRank = rankMetric(players, (p) => (p as PoolPlayer).dot_pct, "high");
  const bowlBndRank = rankMetric(players, (p) => (p as PoolPlayer).bowl_boundary_pct, "low");
  const fieldRank = rankMetric(players, (p) => (p as PoolPlayer).field_ratio, "high");
  for (const p of players) {
    p.bnd_rank = bndRank.get(p.id) ?? 9999;
    p.dot_pct_rank = dotRank.get(p.id) ?? 9999;
    p.bowl_bnd_rank = bowlBndRank.get(p.id) ?? 9999;
    p.field_ratio_rank = fieldRank.get(p.id) ?? 9999;
  }

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
