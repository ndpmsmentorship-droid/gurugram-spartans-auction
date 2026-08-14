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
import { tierStyle, handSkill, normCategory } from "@/lib/scout/tier";
import { basePriceFor } from "@/lib/auction/rules";
import type { ScoutPlayerRow } from "@/lib/supabase/types";
import PlayerWorkshop from "./PlayerWorkshop";
import MarqueeToggle from "./MarqueeToggle";

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
  const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

  // Auction facts for the portrait card. Base price follows the SDLL category
  // rule (A+ ₹30,000 / A ₹20,000 / B ₹10,000 / Special ₹5,000).
  const basePrice =
    normCategory(player.auction_category) == null
      ? "—"
      : inr(basePriceFor(player.auction_category));
  const soldPrice = (player as unknown as { sold_price: number | null }).sold_price;

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-7 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/scout" className="text-[0.875rem] text-muted transition hover:text-red">
          ← Back to pool
        </Link>
        <PlayerSearch players={pool.map((p) => ({ id: p.id, full_name: p.full_name }))} />
      </div>

      {/* Portrait column beside everything else, per the design comp: the photo
          card carries the auction facts (base price / tier / status) so the
          numbers an owner needs mid-lot never scroll away. */}
      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[12px] border border-line bg-surface">
          <Headshot name={player.full_name} url={player.photo_url} />
          <dl className="flex flex-col gap-3 border-t border-line px-4 py-4 text-[0.813rem]">
            <BioRow k="Base price" v={basePrice} />
            <BioRow k="Auction tier" v={player.auction_category ?? "—"} />
            <BioRow
              k="Status"
              v={soldPrice != null ? `Sold · ${inr(soldPrice)}` : "Unsold"}
              accent={soldPrice != null}
            />
            {player.cricheroes_link ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">CricHeroes</dt>
                <dd>
                  <a
                    href={player.cricheroes_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-text hover:underline"
                  >
                    View profile ↗
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
      {/* identity hero — container-queried so it scales intact when the live
          board later renders this on a projector */}
      <section
        className="rounded-[12px] border border-line px-6 py-7 sm:px-8"
        style={{
          containerType: "inline-size",
          background:
            "linear-gradient(105deg, var(--blush-a) 0%, var(--blush-b) 55%, var(--surface) 100%)",
        }}
      >
        {/* stacks below sm — side by side the identity column collapses to a
            few characters wide and the name wraps to one word per line */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 sm:flex-1">
            {/* role · archetype, per the comp — the bat/bowl style is a chip
                below, not part of the identity line */}
            <p className="eyebrow">
              {a.roleGroup} · {a.archetype}
            </p>
            <h1
              className="mt-3 font-display font-bold"
              style={{ fontSize: "clamp(2rem, 4.4cqw, 3.75rem)", lineHeight: 0.9 }}
            >
              {player.full_name}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-2">
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
              {player.age != null ? (
                <span className="badge border border-line2 bg-surface/70 uppercase text-muted">
                  Age {player.age}
                </span>
              ) : null}
              {handSkill(player.batting_style, player.bowling_style) ? (
                <span className="badge border border-line2 bg-surface/70 uppercase text-muted">
                  {handSkill(player.batting_style, player.bowling_style)}
                </span>
              ) : null}
              {a.riskFlags.map((f) => (
                <span
                  key={f.label}
                  className="badge border uppercase"
                  style={
                    f.level === "red"
                      ? {
                          background: "color-mix(in srgb, var(--down) 10%, #fff)",
                          color: "var(--down)",
                          borderColor: "color-mix(in srgb, var(--down) 35%, transparent)",
                        }
                      : {
                          background: "var(--gold-fill)",
                          color: "var(--gold)",
                          borderColor: "var(--gold-line)",
                        }
                  }
                >
                  {f.label}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            {isAdmin ? (
              <div className="mb-3 flex justify-start sm:justify-end">
                <MarqueeToggle id={player.id} initial={player.is_marquee} />
              </div>
            ) : player.is_marquee ? (
              <div
                className="badge mb-3 border uppercase"
                style={{
                  background: "var(--gold-fill)",
                  borderColor: "var(--gold-line)",
                  color: "var(--gold)",
                }}
              >
                ★ Marquee — must buy
              </div>
            ) : null}
            <p
              className="font-display font-bold leading-[0.85]"
              style={{ fontSize: "clamp(2.75rem, 5.4cqw, 4.75rem)" }}
            >
              {round1(player.overall_index)}
              <span className="num text-[0.28em] font-normal text-muted">/100</span>
            </p>
            <p className="num mt-2.5 text-[0.688rem] uppercase tracking-[0.14em] text-muted">
              Overall #{rankedSelf.overall_rank} · VOR {a.vor >= 0 ? "+" : ""}
              {a.vor}
            </p>
          </div>
        </div>
      </section>

      {/* Index profile beside Batting, per the design comp. The sub-indices
          read as four horizontal bars — a radar is prettier but you cannot
          compare two players' spokes by eye, and length you can. */}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 font-display text-[1rem] tracking-[0.14em]">
            Index profile
          </h2>
          <div className="flex flex-col gap-4">
            <IndexRow label="Batting" score={player.bat_index} rank={rankedSelf.bat_rank} />
            <IndexRow label="Bowling" score={player.bowl_index} rank={rankedSelf.bowl_rank} />
            <IndexRow label="Fielding" score={player.field_index} rank={rankedSelf.field_rank} />
            <IndexRow label="Keeping" score={player.keep_index} rank={rankedSelf.keep_rank} />
          </div>
        </section>

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

      <div className="grid gap-6 xl:grid-cols-2">
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
        <section className="card">
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
      <section>
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
        </div>
      </div>
    </main>
  );
}

// A label/value line in the portrait card's auction facts.
function BioRow({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className={`num ${accent ? "text-red" : "text-ink"}`}>{v}</dd>
    </div>
  );
}

// One sub-index: name + score/rank on a line, bar beneath. Replaces the radar —
// four bars can be read (and compared between players) at a glance.
function IndexRow({
  label,
  score,
  rank,
}: {
  label: string;
  score: number | null;
  rank: number | null;
}) {
  const v = score == null ? 0 : Math.max(2, Math.min(100, score));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.938rem] text-ink">{label}</span>
        <span className="num shrink-0 text-[0.938rem] font-medium text-ink">
          {score == null ? "—" : Math.round(score)}
          {rank != null && rank < 9999 && (
            <span className="ml-1.5 text-[0.75rem] font-normal text-muted">#{rank}</span>
          )}
        </span>
      </div>
      <div className="rail mt-2">
        <span style={{ width: `${v}%` }} />
      </div>
    </div>
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
        className="aspect-[4/5] w-full object-cover object-center"
      />
    );
  }
  return (
    <div
      className="flex aspect-[4/5] w-full items-center justify-center font-display text-[3.5rem] text-faint"
      style={{
        background:
          "repeating-linear-gradient(135deg, var(--chip) 0 9px, transparent 9px 18px), var(--tile)",
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
  // Percentile bars are a strength read, so they carry the up/down encoding
  // (green strong, amber mid, red weak) — distinct from the index bars above,
  // which are maroon because they're a magnitude, not a verdict.
  const color =
    percentile == null
      ? "var(--line2)"
      : percentile >= 66
        ? "var(--up)"
        : percentile >= 33
          ? "#C08A2E"
          : "var(--down)";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[0.875rem]">
        <span className="text-ink">
          {label}
          {hint ? <span className="text-muted"> · {hint}</span> : null}
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
      <p className="mt-1.5 text-[0.75rem] text-muted">
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
