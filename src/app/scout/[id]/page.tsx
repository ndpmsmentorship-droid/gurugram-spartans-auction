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

const ACCENT = "var(--red)"; // brand red — the only hue in the Shanti Devi book

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
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/scout" className="text-[0.813rem] text-muted transition hover:text-red">
          ← Back to pool
        </Link>
        <PlayerSearch players={pool.map((p) => ({ id: p.id, full_name: p.full_name }))} />
      </div>

      {/* identity hero — container-queried so it scales intact when the live
          board later renders this on a projector */}
      <section
        className="mt-4 rounded-[14px] border border-line px-6 py-7 sm:px-8"
        style={{
          containerType: "inline-size",
          background:
            "linear-gradient(120deg, color-mix(in srgb, var(--red-deep) 18%, transparent), transparent 62%), var(--surface)",
        }}
      >
        {/* stacks below sm — side by side the identity column collapses to a
            few characters wide and the name wraps to one word per line */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 sm:flex-1">
            <p className="eyebrow">
              {a.roleGroup}
              {handSkill(player.batting_style, player.bowling_style)
                ? ` · ${handSkill(player.batting_style, player.bowling_style)}`
                : ""}
            </p>
            <h1
              className="mt-3 font-display font-bold"
              style={{ fontSize: "clamp(2rem, 4.4cqw, 3.75rem)", lineHeight: 0.9 }}
            >
              {player.full_name}
            </h1>
            {player.cricheroes_link && (
              <a
                href={player.cricheroes_link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 inline-block text-[0.813rem] text-accent-text hover:underline"
              >
                View CricHeroes profile ↗
              </a>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {(() => {
                const ts = tierStyle(player.auction_category);
                return ts ? (
                  <span
                    className="badge uppercase"
                    style={{ background: ts.bg, color: ts.fg }}
                    title="Organizers' auction category"
                  >
                    {player.auction_category}
                  </span>
                ) : null;
              })()}
              <span
                className="badge"
                style={{ border: "1px solid var(--line2)", color: "var(--muted)" }}
              >
                {a.archetype}
              </span>
              {a.riskFlags.map((f) => (
                <span
                  key={f.label}
                  className="badge"
                  style={
                    f.level === "red"
                      ? {
                          background: "color-mix(in srgb, var(--down) 16%, transparent)",
                          color: "var(--down)",
                          border: "1px solid color-mix(in srgb, var(--down) 40%, transparent)",
                        }
                      : {
                          background: "color-mix(in srgb, var(--highlight) 14%, transparent)",
                          color: "var(--highlight)",
                          border:
                            "1px solid color-mix(in srgb, var(--highlight) 38%, transparent)",
                        }
                  }
                >
                  {f.label}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            {isAdmin && (
              <div className="mb-2 flex justify-start sm:justify-end">
                <MarqueeToggle id={player.id} initial={player.is_marquee} />
              </div>
            )}
            {player.is_marquee && !isAdmin && (
              <div
                className="badge mb-2"
                style={{
                  background: "color-mix(in srgb, var(--highlight) 14%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--highlight) 45%, transparent)",
                  color: "var(--highlight)",
                }}
              >
                ★ Marquee — must buy
              </div>
            )}
            <p
              className="font-display font-bold leading-[0.85]"
              style={{ fontSize: "clamp(2.75rem, 5.2cqw, 4.5rem)" }}
            >
              {round1(player.overall_index)}
              <span className="num text-[0.3em] font-normal text-faint">/100</span>
            </p>
            <p className="num mt-2.5 text-[0.688rem] uppercase tracking-[0.14em] text-muted">
              Overall #{rankedSelf.overall_rank} · VOR {a.vor >= 0 ? "+" : ""}
              {a.vor}
            </p>
          </div>
        </div>
      </section>

      {/* headshot + index profile side by side — the portrait is deliberately
          narrow so the index card, not the photo, carries the width */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <div className="flex justify-center lg:justify-start">
          <Headshot name={player.full_name} url={player.photo_url} />
        </div>
        <section className="card">
          <h2 className="mb-3 border-b border-line pb-3 font-display text-[0.938rem] tracking-[0.16em]">
            Index profile
          </h2>
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
          <div className="mt-4 grid grid-cols-2 gap-2">
            <RankPill label="Batting" score={player.bat_index} rank={rankedSelf.bat_rank} />
            <RankPill label="Bowling" score={player.bowl_index} rank={rankedSelf.bowl_rank} />
            <RankPill label="Fielding" score={player.field_index} rank={rankedSelf.field_rank} />
            <RankPill label="Keeping" score={player.keep_index} rank={rankedSelf.keep_rank} />
          </div>
        </section>
      </div>


      {/* Batting runs full width — 12 tiles never fit a half-column without
          crushing them, and it was previously stranded in a 2-col grid with an
          empty right half. */}
      <div className="mt-6">
        <StatSection
          title="Batting"
          cols={6}
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
          <p className="eyebrow mb-3">Scouting note</p>
          {player.scouting_note && (
            <p className="text-[0.875rem] leading-relaxed">{player.scouting_note}</p>
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
        <p className="eyebrow mb-3">Players like {player.full_name}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {a.similarIds.map((sid) => {
            const sp = byId.get(sid);
            if (!sp) return null;
            const sa = analytics.get(sid)!;
            return (
              <Link
                key={sid}
                href={`/scout/${sid}`}
                className="card p-4 transition hover:border-red"
              >
                <p className="truncate font-display text-[1rem] font-semibold">
                  {sp.full_name}
                </p>
                <p className="mt-1 truncate text-[0.75rem] text-faint">{sa.archetype}</p>
                <p className="num mt-2.5 text-[0.813rem] text-muted">
                  Overall{" "}
                  <span className="font-medium text-ink">{round1(sp.overall_index)}</span>
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
        height={560}
        unoptimized={false}
        className="aspect-[4/5] w-full max-w-md rounded-[14px] border border-line object-cover object-center"
        style={{ boxShadow: "var(--elev)" }}
      />
    );
  }
  return (
    <div
      className="flex aspect-[4/5] w-full max-w-md items-center justify-center rounded-[14px] border border-line font-display text-[5rem] text-faint"
      style={{
        background:
          "repeating-linear-gradient(135deg, var(--chip) 0 8px, transparent 8px 16px), var(--surface)",
        boxShadow: "var(--elev)",
      }}
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
    <div className="tile px-3 py-2.5">
      <p className="label-mono">{label}</p>
      <p className="mt-1.5 font-display text-[1.125rem] font-semibold leading-none">
        {score == null ? "—" : Math.round(score)}
        {rank != null && rank < 9999 && (
          <span className="num ml-1.5 text-[0.688rem] font-normal text-faint">
            #{rank}
          </span>
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
  // One hue ramp, not a traffic light: strength is carried by how FAR the rail
  // fills, and the brand red simply deepens with it. A green/amber/red scale
  // would put two competing hues next to the brand colour.
  const color =
    percentile == null
      ? "var(--line2)"
      : percentile >= 66
        ? "linear-gradient(90deg, var(--red-deep), var(--red))"
        : percentile >= 33
          ? "color-mix(in srgb, var(--red) 62%, var(--line2))"
          : "color-mix(in srgb, var(--red) 32%, var(--line2))";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[0.813rem]">
        <span className="text-muted">
          {label}
          {hint ? <span className="text-faint"> · {hint}</span> : null}
        </span>
        <span className="num shrink-0 font-medium text-ink">
          {value == null ? "—" : `${value.toFixed(decimals)}${unit}`}
        </span>
      </div>
      <div className="rail mt-2">
        <span
          className="transition-[width]"
          style={{ width: `${fill}%`, background: color }}
        />
      </div>
      <p className="label-mono mt-1.5">
        {percentile != null
          ? `Top ${Math.max(1, Math.round(100 - percentile))}% of the pool`
          : "No data"}
      </p>
    </div>
  );
}

// A single CricHeroes-style stat tile: bold number over a small mono label.
function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="tile px-1.5 py-3 text-center">
      <p className="font-display text-[1.375rem] font-bold leading-none">
        {value === "" ? "—" : value}
      </p>
      <p className="label-mono mt-1.5">{label}</p>
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
  cols = 4,
  children,
}: {
  title: string;
  indexScore: number | null;
  rank: number | null;
  tiles: { label: string; value: string | number }[];
  /** tile columns at >=sm; 4 for half-width cards, 6 for a full-width one */
  cols?: 4 | 6;
  children?: ReactNode;
}) {
  return (
    <section className="card">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <h2 className="font-display text-[0.938rem] tracking-[0.16em]">{title}</h2>
        {indexScore != null ? (
          <span
            className="badge"
            style={{
              background: "color-mix(in srgb, var(--red-deep) 20%, transparent)",
              color: "var(--accent-text)",
            }}
          >
            {Math.round(indexScore)}
            <span className="text-faint">/100</span>
            {rank != null && rank < 9999 ? (
              <span className="ml-1 text-faint">· #{rank}</span>
            ) : null}
          </span>
        ) : null}
      </div>
      <div
        className={`mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 ${
          cols === 6 ? "lg:grid-cols-6" : ""
        }`}
      >
        {tiles.map((t) => (
          <Tile key={t.label} label={t.label} value={t.value} />
        ))}
      </div>
      {children ? (
        <div className="mt-4 flex flex-col gap-3.5 border-t border-line pt-4">{children}</div>
      ) : null}
    </section>
  );
}
