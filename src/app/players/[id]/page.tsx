import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Profile for a squad player. Sourced from sccl_s6_players (the SCCL roster the
// auction runs on) — the same table My Squad, Squads and the live board read —
// so every squad member has a profile, not just the 147 that also sit in the
// SDLL scout pool.
export default async function SquadPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;

  const admin = createAdminClient();
  const sb = admin as unknown as { from: (t: string) => any };

  const { data: player } = await sb.from("sccl_s6_players").select("*").eq("id", id).maybeSingle();
  if (!player) notFound();

  // Rank the whole roster by overall index → the player's #NNN unique id.
  const { data: pool } = await sb.from("sccl_s6_players").select("id, overall_index");
  const ranked = ((pool ?? []) as any[])
    .filter((p) => p.overall_index != null)
    .sort((a, b) => b.overall_index - a.overall_index);
  const rank = ranked.findIndex((p) => p.id === id);
  const rankId = rank >= 0 ? "#" + String(rank + 1).padStart(3, "0") : "—";

  // Team name for the crumb.
  let teamName: string | null = null;
  if (player.team_id) {
    const { data: t } = await sb.from("teams").select("name").eq("id", player.team_id).maybeSingle();
    teamName = (t as any)?.name ?? null;
  }

  const back = backLink(from);

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-7 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={back.href} className="text-[0.875rem] text-muted transition hover:text-red">
          ← {back.label}
        </Link>
        {teamName && <span className="label-mono">{teamName}</span>}
      </div>

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        {/* portrait + auction facts */}
        <aside className="overflow-hidden rounded-[12px] border border-line bg-surface">
          <Headshot name={player.full_name} url={player.photo_url} />
          <dl className="flex flex-col gap-3 border-t border-line px-4 py-4 text-[0.813rem]">
            <BioRow k="Rank ID" v={rankId} accent />
            <BioRow k="Auction tier" v={player.auction_category ?? "—"} />
            <BioRow k="Age" v={player.age != null ? String(player.age) : "—"} />
            {player.cricheroes_link ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">CricHeroes</dt>
                <dd>
                  <a
                    href={player.cricheroes_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red hover:underline"
                  >
                    View ↗
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          {/* hero */}
          <section
            className="rounded-[12px] border border-line px-6 py-7 sm:px-8"
            style={{
              containerType: "inline-size",
              background:
                "linear-gradient(105deg, var(--blush-a, #fbeeee) 0%, var(--blush-b, #f6e3e3) 55%, var(--surface) 100%)",
            }}
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 sm:flex-1">
                <p className="eyebrow">
                  {[player.primary_role, player.auction_category].filter(Boolean).join(" · ") || "Player"}
                </p>
                <h1
                  className="mt-3 font-display font-bold"
                  style={{ fontSize: "clamp(1.9rem, 4.2cqw, 3.4rem)", lineHeight: 0.9 }}
                >
                  {player.full_name}
                  {player.is_marquee && <span className="ml-2 align-middle text-[0.5em] text-red">★</span>}
                </h1>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {player.is_keeper && <Tag>Wicket-keeper</Tag>}
                  {player.batting_style && <Tag>{player.batting_style}</Tag>}
                  {player.bowling_style && <Tag>{player.bowling_style}</Tag>}
                  {player.is_marquee && <Tag accent>★ Marquee</Tag>}
                </div>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p
                  className="font-display font-bold leading-[0.85]"
                  style={{ fontSize: "clamp(2.5rem, 5cqw, 4.25rem)" }}
                >
                  {n1(player.overall_index)}
                  <span className="num text-[0.28em] font-normal text-muted">/100</span>
                </p>
                <p className="num mt-2.5 text-[0.688rem] uppercase tracking-[0.14em] text-muted">
                  Overall {rankId}
                </p>
              </div>
            </div>
          </section>

          {/* index bars */}
          <section className="card">
            <h2 className="mb-4 font-display text-[1rem] tracking-[0.14em]">Index profile</h2>
            <div className="flex flex-col gap-4">
              <IndexRow label="Batting" score={player.bat_index} />
              <IndexRow label="Bowling" score={player.bowl_index} />
              <IndexRow label="Fielding" score={player.field_index} />
              <IndexRow label="Keeping" score={player.keep_index} />
            </div>
          </section>

          {/* batting */}
          <StatSection title="Batting" indexScore={player.bat_index}
            tiles={[
              { label: "Matches", value: fmt(player.bat_matches) },
              { label: "Innings", value: fmt(player.bat_innings) },
              { label: "Runs", value: fmt(player.runs) },
              { label: "Avg", value: n1(player.bat_avg) },
              { label: "SR", value: n1(player.bat_sr) },
              { label: "HS", value: player.highest_score || "—" },
              { label: "50s", value: fmt(player.fifties) },
              { label: "100s", value: fmt(player.hundreds) },
              { label: "4s", value: fmt(player.fours) },
              { label: "6s", value: fmt(player.sixes) },
              { label: "Not out", value: fmt(player.not_out) },
              { label: "Ducks", value: fmt(player.ducks) },
            ]}
          />

          {/* bowling */}
          <StatSection title="Bowling" indexScore={player.bowl_index}
            tiles={[
              { label: "Matches", value: fmt(player.bowl_matches) },
              { label: "Overs", value: n1(player.overs) },
              { label: "Wickets", value: fmt(player.wickets) },
              { label: "Econ", value: n1(player.economy) },
              { label: "Avg", value: n1(player.bowl_avg) },
              { label: "SR", value: n1(player.bowl_sr) },
              { label: "3W", value: fmt(player.three_w) },
              { label: "5W", value: fmt(player.five_w) },
              { label: "Maidens", value: fmt(player.maidens) },
              { label: "Dots", value: fmt(player.dot_balls) },
              { label: "Runs", value: fmt(player.bowl_runs) },
            ]}
          />

          {/* fielding */}
          <StatSection title="Fielding" indexScore={player.field_index}
            tiles={[
              { label: "Catches", value: fmt(player.catches) },
              { label: "Run-outs", value: fmt(player.run_outs) },
              { label: "Stumpings", value: fmt(player.stumpings) },
              { label: "WK catches", value: fmt(player.keeping_catches) },
            ]}
          />
        </div>
      </div>
    </main>
  );
}

function backLink(from?: string): { href: string; label: string } {
  switch (from) {
    case "my-team":
      return { href: "/my-team", label: "Back to My Squad" };
    case "squad":
      return { href: "/squad", label: "Back to Squads" };
    case "auction":
      return { href: "/auction", label: "Back to Live Board" };
    default:
      return { href: "/my-team", label: "Back to My Squad" };
  }
}

const n1 = (v: number | null | undefined) => (v == null ? "—" : Math.round(v * 10) / 10);
const fmt = (v: number | null | undefined) =>
  v == null ? "—" : Math.round(v).toLocaleString("en-IN");

function BioRow({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className={`num ${accent ? "text-red font-semibold" : "text-ink"}`}>{v}</dd>
    </div>
  );
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`badge border uppercase ${
        accent ? "border-red text-red" : "border-line2 bg-surface/70 text-muted"
      }`}
    >
      {children}
    </span>
  );
}

function IndexRow({ label, score }: { label: string; score: number | null }) {
  const v = score == null ? 0 : Math.max(2, Math.min(100, score));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.938rem] text-ink">{label}</span>
        <span className="num shrink-0 text-[0.938rem] font-medium text-ink">
          {score == null ? "—" : Math.round(score)}
        </span>
      </div>
      <div className="rail mt-2">
        <span style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

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
        className="aspect-[4/5] w-full object-cover object-center"
      />
    );
  }
  return (
    <div
      className="flex aspect-[4/5] w-full items-center justify-center font-display text-[3.5rem] text-faint"
      style={{
        background:
          "repeating-linear-gradient(135deg, var(--chip, #eee) 0 9px, transparent 9px 18px), var(--tile, #f6f6f6)",
      }}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="tile px-1.5 py-3 text-center">
      <p className="font-display text-[1.375rem] font-bold leading-none">{value === "" ? "—" : value}</p>
      <p className="label-mono mt-1.5">{label}</p>
    </div>
  );
}

function StatSection({
  title,
  indexScore,
  tiles,
}: {
  title: string;
  indexScore: number | null;
  tiles: { label: string; value: string | number }[];
}) {
  return (
    <section className="card">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <h2 className="font-display text-[0.938rem] tracking-[0.16em]">{title}</h2>
        {indexScore != null ? (
          <span
            className="badge"
            style={{
              background: "color-mix(in srgb, var(--red) 18%, transparent)",
              color: "var(--red)",
            }}
          >
            {Math.round(indexScore)}
            <span className="opacity-60">/100</span>
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <Tile key={t.label} label={t.label} value={t.value} />
        ))}
      </div>
    </section>
  );
}
