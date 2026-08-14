import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

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

const n1 = (v: number | null | undefined) => (v == null ? "—" : Math.round(v * 10) / 10);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

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
    .select("id, name, division, purse_total")
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

  return (
    <Shell wide>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My Squad</p>
          <h1 className="mt-2 font-display text-[2.5rem] leading-none">{team.name}</h1>
          <p className="mt-2 label-mono">
            {team.division ?? "—"} · {squad.length} players
          </p>
        </div>
      </div>

      {/* insight tiles */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Squad" value={String(squad.length)} />
        <Tile label="Team strength" value={n1(teamStrength)} accent />
        <Tile label="Batting" value={n1(batStrength)} sub="top 7 index" />
        <Tile label="Bowling" value={n1(bowlStrength)} sub="top 5 index" />
        <Tile label="Marquee" value={String(marquee)} />
        <Tile label="Career runs" value={totRuns.toLocaleString("en-IN")} sub={`${totWkts} wkts`} />
      </div>

      {/* role mix */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip label="Batters" n={roles.BAT} />
        <Chip label="All-rounders" n={roles.AR} />
        <Chip label="Bowlers" n={roles.BOWL} />
        <Chip label="Keepers" n={roles.WK} />
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
                    {p.full_name}
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

function Tile({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-[12px] border border-line bg-surface px-4 py-3">
      <p className={`font-display text-[1.6rem] leading-none ${accent ? "text-red" : "text-ink"}`}>{value}</p>
      <p className="label-mono mt-1.5">{label}</p>
      {sub && <p className="mt-0.5 text-[0.65rem] text-muted">{sub}</p>}
    </div>
  );
}

function Chip({ label, n }: { label: string; n: number }) {
  return (
    <span className="rounded-full border border-line bg-surface px-3 py-1 text-[0.8rem]">
      <span className="num font-semibold">{n}</span> <span className="text-muted">{label}</span>
    </span>
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
                <span className="w-32 shrink-0 truncate text-sm font-medium sm:w-40">{p.full_name}</span>
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
