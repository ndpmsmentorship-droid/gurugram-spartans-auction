import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rankPlayers } from "@/lib/scout/ranks";
import { computeAnalytics, type AnalyticsInput } from "@/lib/scout/analytics";
import { deriveMetrics, type RawStats } from "@/lib/scout/rankings";
import type { ScoutPlayerRow } from "@/lib/supabase/types";
import Radar from "../Radar";
import BuyControl from "./BuyControl";

const ACCENT = "#e07a3e";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.from("scout_players").select("*");
  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <p className="text-down">Failed to load: {error.message}</p>
      </main>
    );
  }

  const pool = (data ?? []) as ScoutPlayerRow[];
  const player = pool.find((p) => p.id === id);
  if (!player) notFound();

  const ranked = rankPlayers(pool);
  const rankedSelf = ranked.find((p) => p.id === id)!;
  const analytics = computeAnalytics(pool as unknown as AnalyticsInput[]);
  const a = analytics.get(id)!;
  const metrics = deriveMetrics(player as unknown as RawStats);
  const byId = new Map(pool.map((p) => [p.id, p]));

  const round1 = (v: number | null | undefined) =>
    v == null ? "—" : Math.round(v * 10) / 10;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
      <Link href="/scout" className="text-sm text-muted hover:text-accent-text">
        ← Back to pool
      </Link>

      {/* header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{a.roleGroup}</p>
          <h1 className="mt-1 font-display text-3xl font-bold">
            {player.full_name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="badge bg-wash text-accent-text">{a.archetype}</span>
            {a.riskFlags.map((f) => (
              <span
                key={f.label}
                className={`badge ${
                  f.level === "red"
                    ? "bg-down/15 text-down"
                    : "bg-accent/20 text-accent-text"
                }`}
              >
                {f.label}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <span className="badge bg-ink text-[var(--surface)]">
            Overall #{rankedSelf.overall_rank}
          </span>
          <p className="mt-1 font-display text-2xl font-bold">
            {round1(player.overall_index)}
            <span className="text-sm font-normal text-muted">/100</span>
          </p>
          <p className="text-xs text-muted">VOR {a.vor >= 0 ? "+" : ""}{a.vor}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* radar + ranks */}
        <section className="card">
          <p className="eyebrow mb-2">Index profile</p>
          <Radar
            series={[
              {
                label: player.full_name,
                color: ACCENT,
                values: [
                  player.bat_index ?? 0,
                  player.bowl_index ?? 0,
                  player.field_index ?? 0,
                  player.keep_index ?? 0,
                ],
              },
            ]}
          />
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <RankPill label="Batting" score={player.bat_index} rank={rankedSelf.bat_rank} />
            <RankPill label="Bowling" score={player.bowl_index} rank={rankedSelf.bowl_rank} />
            <RankPill label="Fielding" score={player.field_index} rank={rankedSelf.field_rank} />
            <RankPill label="Keeping" score={player.keep_index} rank={rankedSelf.keep_rank} />
          </div>
        </section>

        {/* advanced stats */}
        <section className="card">
          <p className="eyebrow mb-2">Advanced metrics</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Stat label="Bat avg" value={round1(player.bat_avg)} />
            <Stat label="Strike rate" value={round1(player.bat_sr)} />
            <Stat label="Boundary %" value={round1(metrics.boundaryPct)} />
            <Stat label="Balls / boundary" value={round1(metrics.ballsPerBoundary)} />
            <Stat label="Finishing %" value={round1(metrics.finishingRate)} />
            <Stat label="Runs" value={round1(player.runs)} />
            <Stat label="Wickets" value={round1(player.wickets)} />
            <Stat label="Economy" value={round1(player.economy)} />
            <Stat label="Bowl avg" value={round1(player.bowl_avg)} />
            <Stat label="Wkts / match" value={round1(metrics.wicketsPerMatch)} />
            <Stat label="Catches / match" value={round1(metrics.catchesPerMatch)} />
            <Stat label="Stumpings / match" value={round1(metrics.stumpingsPerMatch)} />
          </dl>
        </section>
      </div>

      {/* buy */}
      <section className="card mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display font-semibold">Auction action</p>
          <p className="text-sm text-muted">
            Mark this player bought at the price you won them for.
          </p>
        </div>
        <BuyControl
          playerId={player.id}
          isBought={player.is_bought}
          boughtPrice={player.bought_price}
        />
      </section>

      {/* similar players */}
      <section className="mt-6">
        <p className="eyebrow mb-2">Players like {player.full_name}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {a.similarIds.map((sid) => {
            const sp = byId.get(sid);
            if (!sp) return null;
            const sa = analytics.get(sid)!;
            return (
              <Link key={sid} href={`/scout/${sid}`} className="card hover:border-accent">
                <p className="truncate font-display font-semibold">{sp.full_name}</p>
                <p className="text-xs text-muted">{sa.archetype}</p>
                <p className="mt-1 text-sm">
                  Overall {round1(sp.overall_index)}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function RankPill({
  label,
  score,
  rank,
}: {
  label: string;
  score: number | null;
  rank: number | null;
}) {
  return (
    <div className="rounded-[12px] bg-wash px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold">
        {score == null ? "—" : Math.round(score)}
        {rank != null && rank < 9999 && (
          <span className="ml-1 text-xs font-normal text-muted">#{rank}</span>
        )}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-1">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
