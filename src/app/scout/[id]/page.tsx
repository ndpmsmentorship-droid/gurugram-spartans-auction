import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import PlayerSearch from "./PlayerSearch";
import { rankPlayers } from "@/lib/scout/ranks";
import { computeAnalytics, type AnalyticsInput } from "@/lib/scout/analytics";
import { deriveMetrics, percentileColumn, type RawStats } from "@/lib/scout/rankings";
import { tierStyle, handSkill } from "@/lib/scout/tier";
import type { ScoutPlayerRow } from "@/lib/supabase/types";
import Radar from "../Radar";
import PlayerWorkshop from "./PlayerWorkshop";
import MarqueeToggle from "./MarqueeToggle";

const ACCENT = "#4a6bb5"; // pastel navy — matches the app accent

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Admin client so the public (no login) can view profiles; edit controls are
  // gated to admins below.
  const supabase = createAdminClient();
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

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

  // Pool-wide percentiles for the "infographic" bars below — same normalization
  // the index engine uses, so a bar's fill matches how the metric actually
  // scores. `invert` = true where a LOWER raw value is better.
  const poolDerived = pool.map((p) => deriveMetrics(p as unknown as RawStats));
  const selfIdx = pool.findIndex((p) => p.id === id);
  const pctAt = (col: (number | null)[]) => col[selfIdx];
  const pctBoundaryBat = pctAt(percentileColumn(poolDerived.map((m) => m.boundaryPct)));
  const pctDotBall = pctAt(percentileColumn(poolDerived.map((m) => m.dotBallPct)));
  const pctBoundaryConceded = pctAt(
    percentileColumn(poolDerived.map((m) => m.boundaryConcededPct), true)
  );
  const pctCatches = pctAt(percentileColumn(poolDerived.map((m) => m.catchesPerMatch)));
  const pctRunOuts = pctAt(percentileColumn(poolDerived.map((m) => m.runOutsPerMatch)));
  const pctStumpings = pctAt(percentileColumn(poolDerived.map((m) => m.stumpingsPerMatch)));

  const round1 = (v: number | null | undefined) =>
    v == null ? "—" : Math.round(v * 10) / 10;
  const fmt = (v: number | null | undefined) =>
    v == null ? "—" : Math.round(v).toLocaleString("en-IN");

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/scout" className="text-sm text-muted hover:text-accent-text">
          ← Back to pool
        </Link>
        <PlayerSearch players={pool.map((p) => ({ id: p.id, full_name: p.full_name }))} />
      </div>

      {/* identity bar */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{a.roleGroup}</p>
          <h1 className="mt-1 font-display text-3xl font-bold">{player.full_name}</h1>
          {player.cricheroes_link && (
            <a
              href={player.cricheroes_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm text-accent-text hover:underline"
            >
              View CricHeroes profile ↗
            </a>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(() => {
              const ts = tierStyle(player.auction_category);
              return ts ? (
                <span
                  className="badge font-bold uppercase tracking-wide"
                  style={{ background: ts.bg, color: ts.fg }}
                  title="Organizers' auction category"
                >
                  {player.auction_category}
                </span>
              ) : null;
            })()}
            <span className="badge bg-wash text-accent-text">{a.archetype}</span>
            {handSkill(player.batting_style, player.bowling_style) ? (
              <span className="badge bg-wash text-muted">
                {handSkill(player.batting_style, player.bowling_style)}
              </span>
            ) : null}
            {a.riskFlags.map((f) => (
              <span
                key={f.label}
                className={`badge ${
                  f.level === "red" ? "bg-down/15 text-down" : "bg-accent/20 text-accent-text"
                }`}
              >
                {f.label}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right">
          {isAdmin && (
            <div className="mb-2 flex justify-end">
              <MarqueeToggle id={player.id} initial={player.is_marquee} />
            </div>
          )}
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

      {/* big headshot + index profile side by side */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <div className="flex justify-center lg:justify-start">
          <Headshot name={player.full_name} url={player.photo_url} />
        </div>
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
      </div>


      <div className="mt-6 grid gap-6 md:grid-cols-2">

        {/* batting stat tiles + boundary % */}
        <StatSection
          title="Batting"
          indexScore={player.bat_index}
          rank={rankedSelf.bat_rank}
          tiles={[
            { label: "Matches", value: fmt(player.bat_matches) },
            { label: "Innings", value: fmt(player.bat_innings) },
            { label: "Runs", value: fmt(player.runs) },
            { label: "Avg", value: round1(player.bat_avg) },
            { label: "SR", value: round1(player.bat_sr) },
            { label: "HS", value: player.highest_score || "—" },
            { label: "50s", value: fmt(player.fifties) },
            { label: "100s", value: fmt(player.hundreds) },
            { label: "4s", value: fmt(player.fours) },
            { label: "6s", value: fmt(player.sixes) },
            { label: "Not out", value: fmt(player.not_out) },
            { label: "Ducks", value: fmt(player.ducks) },
          ]}
        >
          <MetricBar
            label="Boundary %"
            hint="runs from 4s/6s"
            value={metrics.boundaryPct}
            percentile={pctBoundaryBat}
          />
        </StatSection>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* bowling stat tiles + control bars */}
        <StatSection
          title="Bowling"
          indexScore={player.bowl_index}
          rank={rankedSelf.bowl_rank}
          tiles={[
            { label: "Matches", value: fmt(player.bowl_matches) },
            { label: "Overs", value: round1(player.overs) },
            { label: "Wickets", value: fmt(player.wickets) },
            { label: "Econ", value: round1(player.economy) },
            { label: "Avg", value: round1(player.bowl_avg) },
            { label: "SR", value: round1(player.bowl_sr) },
            { label: "3W", value: fmt(player.three_w) },
            { label: "5W", value: fmt(player.five_w) },
            { label: "Maidens", value: fmt(player.maidens) },
            { label: "Dots", value: fmt(player.dot_balls) },
            { label: "Runs", value: fmt(player.bowl_runs) },
          ]}
        >
          <MetricBar
            label="Dot ball %"
            hint="of balls bowled"
            value={metrics.dotBallPct}
            percentile={pctDotBall}
          />
          <MetricBar
            label="Boundary % conceded"
            hint="lower is better"
            value={metrics.boundaryConcededPct}
            percentile={pctBoundaryConceded}
          />
        </StatSection>

        {/* fielding stat tiles + per-match bars */}
        <StatSection
          title="Fielding"
          indexScore={player.field_index}
          rank={rankedSelf.field_rank}
          tiles={[
            { label: "Catches", value: fmt(player.catches) },
            { label: "Run-outs", value: fmt(player.run_outs) },
            { label: "Stumpings", value: fmt(player.stumpings) },
            { label: "WK catches", value: fmt(player.keeping_catches) },
          ]}
        >
          <MetricBar
            label="Catches / match"
            value={metrics.catchesPerMatch}
            decimals={2}
            unit=""
            percentile={pctCatches}
          />
          <MetricBar
            label="Run-outs / match"
            value={metrics.runOutsPerMatch}
            decimals={2}
            unit=""
            percentile={pctRunOuts}
          />
          {player.is_keeper || player.stumpings != null ? (
            <MetricBar
              label="Stumpings / match"
              value={metrics.stumpingsPerMatch}
              decimals={2}
              unit=""
              percentile={pctStumpings}
            />
          ) : null}
        </StatSection>
      </div>


      {/* scouting clip / note (if set) */}
      {(player.scouting_clip_url || player.scouting_note) && (
        <section className="card mt-6">
          <p className="eyebrow mb-2">Scouting note</p>
          {player.scouting_note && (
            <p className="text-sm">{player.scouting_note}</p>
          )}
          {player.scouting_clip_url && (
            <a
              href={player.scouting_clip_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-accent-text hover:underline"
            >
              Watch clip ↗
            </a>
          )}
        </section>
      )}

      {/* update data: screenshot / manual / clip (admins only) */}
      {isAdmin && <PlayerWorkshop player={player} />}

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

// Player headshot: the uploaded photo when we have one, otherwise a clean
// initials avatar (the current auction data has no photo URLs).
function Headshot({ name, url }: { name: string; url: string | null }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={448}
        height={448}
        unoptimized={false}
        className="aspect-square w-full max-w-md rounded-2xl object-cover object-center shadow-sm ring-1 ring-border"
      />
    );
  }
  return (
    <div
      className="flex aspect-square w-full max-w-md items-center justify-center rounded-2xl bg-wash text-8xl font-bold text-accent-text ring-1 ring-border"
      aria-hidden
    >
      {initials || "?"}
    </div>
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

// A labelled bar sized by the player's percentile within the pool for that
// metric (0-100, already pre-inverted upstream so higher fill = better).
function MetricBar({
  label,
  hint,
  value,
  percentile,
  decimals = 1,
  unit = "%",
}: {
  label: string;
  hint?: string;
  value: number | null;
  percentile: number | null;
  decimals?: number;
  unit?: string;
}) {
  const fill = percentile == null ? 0 : Math.max(2, Math.min(100, percentile));
  const color =
    percentile == null
      ? "var(--muted)"
      : percentile >= 66
        ? "var(--up)"
        : percentile >= 33
          ? ACCENT
          : "var(--down)";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted">
          {label}
          {hint ? <span className="text-xs"> · {hint}</span> : null}
        </span>
        <span className="shrink-0 font-semibold tabular-nums">
          {value == null ? "—" : `${value.toFixed(decimals)}${unit}`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-wash">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${fill}%`, background: color }}
        />
      </div>
      {percentile != null ? (
        <p className="mt-0.5 text-[0.65rem] text-muted">
          Top {Math.max(1, Math.round(100 - percentile))}% of the pool
        </p>
      ) : (
        <p className="mt-0.5 text-[0.65rem] text-muted">No data</p>
      )}
    </div>
  );
}

// A single CricHeroes-style stat tile: bold number over a small label.
function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[12px] bg-wash px-1.5 py-2.5 text-center">
      <p className="font-display text-[1.3rem] font-bold leading-none tabular-nums">
        {value === "" ? "—" : value}
      </p>
      <p className="mt-1 text-[0.58rem] font-medium uppercase leading-tight tracking-wide text-muted">
        {label}
      </p>
    </div>
  );
}

// A titled section: sub-index chip, a grid of career stat tiles, then the
// pool-relative percentile bars (passed as children).
function StatSection({
  title,
  indexScore,
  rank,
  tiles,
  children,
}: {
  title: string;
  indexScore: number | null;
  rank: number | null;
  tiles: { label: string; value: string | number }[];
  children?: ReactNode;
}) {
  return (
    <section className="card">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{title}</p>
        {indexScore != null ? (
          <span className="badge" style={{ background: "var(--wash)", color: ACCENT }}>
            {Math.round(indexScore)}
            <span className="text-muted">/100</span>
            {rank != null && rank < 9999 ? (
              <span className="ml-1 text-muted">· #{rank}</span>
            ) : null}
          </span>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {tiles.map((t) => (
          <Tile key={t.label} label={t.label} value={t.value} />
        ))}
      </div>
      {children ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">{children}</div>
      ) : null}
    </section>
  );
}
