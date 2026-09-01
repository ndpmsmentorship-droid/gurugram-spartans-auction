import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import MarkButton from "./MarkButton";
import TeamCrest from "@/app/TeamCrest";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

type P = {
  id: string;
  full_name: string;
  primary_role: string | null;
  auction_category: string | null;
  is_keeper: boolean | null;
  is_marquee: boolean | null;
  age: number | null;
  bat_index: number | null;
  bowl_index: number | null;
  overall_index: number | null;
  runs: number | null;
  wickets: number | null;
  bat_avg: number | null;
  bat_sr: number | null;
  economy: number | null;
};

const n1 = (v: number | null | undefined) => (v == null ? "—" : String(Math.round(v * 10) / 10));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Composition-bar hues, matching the Squads showcase legend.
const ROLE_COLORS: Record<string, string> = {
  Batter: "#D9A82C",
  "All-rounder": "#4FA97A",
  Bowler: "#7B9FD4",
  Keeper: "#A99B99",
};

function bucket(p: P): "WK" | "AR" | "BOWL" | "BAT" {
  const r = (p.primary_role || "").toLowerCase();
  if (p.is_keeper || r.includes("keeper")) return "WK";
  if (r.includes("allrounder") || r.includes("all rounder")) return "AR";
  if (r.includes("bowl") || r.includes("pacer") || r.includes("spin")) return "BOWL";
  return "BAT";
}

export default async function MyTeamPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return <Shell><p className="text-muted">Please sign in.</p></Shell>;
  }

  const admin = createAdminClient();
  const sb = admin as unknown as { from: (t: string) => any };

  const { data: team } = await sb
    .from("teams")
    .select("id, name, division, logo_url, purse_total")
    .eq("owner_profile_id", profile.id)
    .maybeSingle();

  if (!team) {
    return (
      <Shell>
        <p className="eyebrow">My Squad</p>
        <h1 className="mt-2 font-display text-2xl font-bold">No team linked yet</h1>
        <p className="mt-2 text-muted">
          Your account isn&rsquo;t linked to a team. Ask the admin to set you up under{" "}
          <span className="num">Admin → Team Owners</span>.
        </p>
      </Shell>
    );
  }

  const { data: squadRaw } = await sb
    .from("sccl_s6_players")
    .select(
      "id, full_name, primary_role, auction_category, is_keeper, is_marquee, age, " +
        "bat_index, bowl_index, overall_index, runs, wickets, bat_avg, bat_sr, economy"
    )
    .eq("team_id", team.id)
    .order("overall_index", { ascending: false, nullsFirst: false });

  const squad = (squadRaw ?? []) as P[];

  // ---- marked players (targets from the auction pool) ----
  let marked: any[] = [];
  try {
    const { data: marks } = await sb
      .from("player_marks")
      .select("player_id")
      .eq("marker_profile_id", profile.id);
    const ids = (marks ?? []).map((m: any) => m.player_id);
    if (ids.length) {
      const { data } = await sb
        .from("sccl_s6_players")
        .select("id, full_name, auction_category, primary_role, team_id, sold_price, overall_index")
        .in("id", ids);
      marked = ((data ?? []) as any[]).sort(
        (a, b) => (b.overall_index ?? 0) - (a.overall_index ?? 0)
      );
    }
  } catch {
    marked = [];
  }

  // ---- insights ----
  const roles = { BAT: 0, BOWL: 0, AR: 0, WK: 0 };
  squad.forEach((p) => (roles[bucket(p)] += 1));
  const teamStrength = avg(squad.map((p) => p.overall_index).filter((v): v is number => v != null));
  const batStrength = avg(
    squad.map((p) => p.bat_index).filter((v): v is number => v != null).sort((a, b) => b - a).slice(0, 7)
  );
  const bowlStrength = avg(
    squad.map((p) => p.bowl_index).filter((v): v is number => v != null).sort((a, b) => b - a).slice(0, 5)
  );
  const marquee = squad.filter((p) => p.is_marquee).length;
  const totRuns = squad.reduce((s, p) => s + (p.runs || 0), 0);
  const totWkts = squad.reduce((s, p) => s + (p.wickets || 0), 0);
  const topBat = [...squad].filter((p) => p.bat_index != null).sort((a, b) => b.bat_index! - a.bat_index!).slice(0, 5);
  const topBowl = [...squad].filter((p) => p.bowl_index != null).sort((a, b) => b.bowl_index! - a.bowl_index!).slice(0, 5);

  // role composition for the infographic bar
  const roleComp = [
    { key: "BAT", label: "Batters", n: roles.BAT, color: ROLE_COLORS.Batter },
    { key: "AR", label: "All-rounders", n: roles.AR, color: ROLE_COLORS["All-rounder"] },
    { key: "BOWL", label: "Bowlers", n: roles.BOWL, color: ROLE_COLORS.Bowler },
    { key: "WK", label: "Keepers", n: roles.WK, color: ROLE_COLORS.Keeper },
  ];

  return (
    <Shell wide>
      {/* maroon identity band with headline stats — matches the Squads showcase */}
      <header className="band overflow-hidden rounded-[16px]">
        <div className="flex flex-wrap items-center justify-between gap-8 px-6 py-8 sm:px-8">
          <div className="min-w-0">
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.24em] text-white/55">
              My Squad · {team.division ?? "—"}
            </p>
            <h1 className="mt-3 flex items-center gap-3 font-display text-[2.5rem] leading-[0.95] text-white sm:text-[3.25rem]">
              <TeamCrest name={team.name} logoUrl={team.logo_url} size={48} />
              {team.name}
            </h1>
            <p className="num mt-3 text-[0.875rem] text-white/70">
              {squad.length} players · {totRuns.toLocaleString("en-IN")} career runs · {totWkts} wickets
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
            <BandStat n={n1(teamStrength)} label="Team strength" sub="avg overall index" color="#F0564A" />
            <BandStat n={n1(batStrength)} label="Batting" sub="top 7 index" color="#E3B44A" />
            <BandStat n={n1(bowlStrength)} label="Bowling" sub="top 5 index" color="#7FA9EC" />
            <BandStat n={String(marquee)} label="Marquee" sub="must-buy stars" color="#5FC48D" />
          </div>
        </div>
      </header>

      {/* role composition bar + legend */}
      <div className="mt-6">
        <div className="flex h-2.5 gap-1 overflow-hidden">
          {roleComp.map((r) =>
            r.n > 0 ? (
              <div
                key={r.key}
                className="rounded-full"
                style={{ width: `${(r.n / Math.max(1, squad.length)) * 100}%`, background: r.color }}
                title={`${r.label}: ${r.n}`}
              />
            ) : null
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.813rem] text-muted">
          {roleComp.map((r) => (
            <span key={r.key} className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
              {r.label} <b className="num font-medium text-ink">{r.n}</b>
            </span>
          ))}
        </div>
      </div>

      {/* marked players — targets from the auction pool */}
      <div className="mt-6 rounded-[12px] border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="label-mono">Marked players · {marked.length}</span>
          <Link href="/my-team/targets" className="text-[0.8rem] font-medium text-red hover:underline">
            Browse pool →
          </Link>
        </div>
        {marked.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">
            No marked players yet.{" "}
            <Link href="/my-team/targets" className="text-red hover:underline">
              Mark your targets →
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {marked.map((p: any) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/players/${p.id}?from=my-team`}
                    className="block truncate text-sm font-medium hover:text-red hover:underline"
                  >
                    {p.full_name}
                    {p.team_id && (
                      <span className="ml-1.5 text-[0.6rem] uppercase text-muted">sold</span>
                    )}
                  </Link>
                  <span className="num block text-[0.7rem] text-muted">
                    {[p.auction_category, p.primary_role].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <MarkButton playerId={p.id} marked={true} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* top performers */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <TopCard title="Top Batters" accent="bat" list={topBat} metric={(p) => p.bat_index} />
        <TopCard title="Top Bowlers" accent="bowl" list={topBowl} metric={(p) => p.bowl_index} />
      </div>

      {/* full squad */}
      <div className="mt-6 rounded-[12px] border border-line bg-surface">
        <div className="border-b border-line px-4 py-3 label-mono">Full squad</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left label-mono [&>th]:px-4 [&>th]:py-2">
                <th>Player</th>
                <th>Role</th>
                <th>Cat</th>
                <th className="text-right">Runs</th>
                <th className="text-right">Wkts</th>
                <th className="text-right">Index</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((p) => (
                <tr key={p.id} className="border-t border-line [&>td]:px-4 [&>td]:py-2">
                  <td className="font-medium">
                    <Link href={`/players/${p.id}?from=my-team`} className="hover:text-red hover:underline">
                      {p.full_name}
                    </Link>
                    {p.is_marquee && <span className="ml-1.5 text-[0.6rem] uppercase text-red">★</span>}
                  </td>
                  <td className="text-muted">{p.primary_role ?? "—"}</td>
                  <td className="num text-muted">{p.auction_category ?? "—"}</td>
                  <td className="num text-right">{p.runs ?? "—"}</td>
                  <td className="num text-right">{p.wickets ?? "—"}</td>
                  <td className="num text-right font-semibold">{n1(p.overall_index)}</td>
                </tr>
              ))}
              {squad.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No players in this squad yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto w-full ${wide ? "max-w-[1200px]" : "max-w-3xl"} flex-1 px-5 py-8 sm:px-7`}>
      {children}
    </div>
  );
}

// Stat tile on the maroon identity band — number carries the colour, chrome
// stays neutral so the four tiles don't fight each other.
function BandStat({ n, label, sub, color }: { n: string; label: string; sub: string; color: string }) {
  return (
    <div className="min-w-[8rem] rounded-[12px] border border-white/15 bg-white/[0.06] px-4 py-4 text-center">
      <p className="font-display text-[1.875rem] leading-none" style={{ color }}>
        {n}
      </p>
      <p className="mt-2.5 font-mono text-[0.594rem] uppercase tracking-[0.13em] text-white/80">{label}</p>
      <p className="num mt-1 text-[0.625rem] text-white/45">{sub}</p>
    </div>
  );
}

function TopCard({
  title,
  accent,
  list,
  metric,
}: {
  title: string;
  accent: "bat" | "bowl";
  list: P[];
  metric: (p: P) => number | null;
}) {
  const color = accent === "bat" ? "var(--up)" : "var(--red)";
  const max = Math.max(1, ...list.map((p) => metric(p) ?? 0));
  return (
    <div className="rounded-[12px] border border-line bg-surface p-4">
      <p className="label-mono mb-3" style={{ color }}>
        {title}
      </p>
      {list.length === 0 ? (
        <p className="text-sm text-muted">No data.</p>
      ) : (
        <ol className="space-y-2.5">
          {list.map((p, i) => {
            const v = metric(p) ?? 0;
            return (
              <li key={p.id} className="flex items-center gap-3">
                <span className="w-3 shrink-0 num text-[0.7rem] text-muted">{i + 1}</span>
                <Link
                  href={`/players/${p.id}?from=my-team`}
                  className="w-32 shrink-0 truncate text-sm font-medium hover:text-red hover:underline sm:w-40"
                >
                  {p.full_name}
                </Link>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--line)_60%,transparent)]">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(v / max) * 100}%`, background: color }}
                  />
                </span>
                <span className="num w-9 shrink-0 text-right text-sm font-semibold">{Math.round(v * 10) / 10}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
