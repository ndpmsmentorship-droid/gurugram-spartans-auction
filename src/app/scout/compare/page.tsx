import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deriveMetrics, type RawStats } from "@/lib/scout/rankings";
import type { ScoutPlayerRow } from "@/lib/supabase/types";
import CompareView, { type ComparePlayer } from "./CompareView";

export default async function ComparePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("scout_players").select("*");

  if (error || !data || data.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Nothing to compare yet</h1>
        <Link href="/scout/import" className="btn-primary mt-6 inline-block">
          Import players
        </Link>
      </main>
    );
  }

  const pool = data as ScoutPlayerRow[];
  const players: ComparePlayer[] = pool.map((p) => {
    const m = deriveMetrics(p as unknown as RawStats);
    return {
      id: p.id,
      full_name: p.full_name,
      primary_role: p.primary_role,
      bat_index: p.bat_index,
      bowl_index: p.bowl_index,
      field_index: p.field_index,
      keep_index: p.keep_index,
      overall_index: p.overall_index,
      bat_avg: p.bat_avg,
      bat_sr: p.bat_sr,
      runs: p.runs,
      wickets: p.wickets,
      economy: p.economy,
      bowl_avg: p.bowl_avg,
      boundaryPct: m.boundaryPct,
      finishingRate: m.finishingRate,
      wicketsPerMatch: m.wicketsPerMatch,
    };
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      <Link href="/scout" className="text-sm text-muted hover:text-accent-text">
        ← Back to pool
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold">Head-to-head compare</h1>
      <p className="mt-1 text-muted">Pick up to three players to compare side by side.</p>
      <CompareView players={players} />
    </main>
  );
}
