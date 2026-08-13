"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export type BoardTeam = {
  id: string;
  name: string;
  division: string | null;
  purse_total: number;
};
export type BoardPlayer = {
  id: string;
  full_name: string;
  auction_category: string | null;
  team_id: string | null;
  sold_price: number | null;
  acquired: string | null;
  overall_rank?: number | null;
  bat_index?: number | null;
  bowl_index?: number | null;
};

const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const DIVISIONS = ["Elite", "Challengers", "Fighters"];

// Roster's top-N players by a strength metric (nulls excluded), strongest first.
function topList(
  roster: BoardPlayer[],
  metric: (p: BoardPlayer) => number | null | undefined,
  n = 5
): BoardPlayer[] {
  return roster
    .filter((p) => metric(p) != null)
    .sort((a, b) => (metric(b) as number) - (metric(a) as number))
    .slice(0, n);
}

// Small tags after a name (retained / owner).
function Tags({ p }: { p: BoardPlayer }) {
  return (
    <>
      {p.acquired === "retained" && (
        <span className="ml-1 text-[9px] font-semibold uppercase text-highlight-ink" title="Retained">
          R
        </span>
      )}
      {p.acquired === "owner" && (
        <span className="ml-1 text-[9px] font-semibold uppercase text-accent-text" title="Owner">
          O
        </span>
      )}
    </>
  );
}

function RankedGroup({
  label,
  accent,
  list,
}: {
  label: string;
  accent: "bat" | "bowl";
  list: BoardPlayer[];
}) {
  const color = accent === "bat" ? "text-up" : "text-accent-text";
  return (
    <div className="min-w-0">
      <div className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${color}`}>{label}</div>
      {list.length === 0 ? (
        <div className="text-[11px] text-muted">—</div>
      ) : (
        <ol className="space-y-1">
          {list.map((p, i) => (
            <li key={p.id} className="flex items-baseline gap-1.5 text-[13px] leading-tight">
              <span className={`w-3 shrink-0 tabular-nums text-[10px] font-bold ${color}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                {p.full_name}
                <Tags p={p} />
              </span>
              {p.overall_rank != null && (
                <span
                  className="shrink-0 tabular-nums text-[10px] text-muted"
                  title="Our overall pool rank (1 = best)"
                >
                  #{p.overall_rank}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function SquadsBoard({ teams, players }: { teams: BoardTeam[]; players: BoardPlayer[] }) {
  const router = useRouter();

  // Live: re-pull the board every few seconds so spectators see sales roll in.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(id);
  }, [router]);

  const rosterOf = (teamId: string) =>
    players
      .filter((p) => p.team_id === teamId)
      .sort((a, b) => (Number(b.sold_price) || 0) - (Number(a.sold_price) || 0));

  const totalSold = players.length;
  const totalSpend = players.reduce((s, p) => s + (Number(p.sold_price) || 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live Squads</h1>
          <p className="text-sm text-muted">
            Each squad&rsquo;s <span className="text-up">top-5 batters</span> and{" "}
            <span className="text-accent-text">top-5 bowlers</span> by our index ·{" "}
            <span className="text-highlight-ink">R</span> retained · <span className="text-accent-text">O</span> owner ·
            #n = overall pool rank
          </p>
        </div>
        <p className="text-sm text-muted tabular-nums">
          {totalSold} sold · {inr(totalSpend)} spent
        </p>
      </div>

      {DIVISIONS.map((div) => {
        const divTeams = teams.filter((t) => t.division === div);
        if (divTeams.length === 0) return null;
        return (
          <section key={div}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-highlight-ink">{div}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {divTeams.map((t) => {
                const roster = rosterOf(t.id);
                const batTop = topList(roster, (p) => p.bat_index);
                const bowlTop = topList(roster, (p) => p.bowl_index);
                const topIds = new Set([...batTop, ...bowlTop].map((p) => p.id));
                const rest = roster.filter((p) => !topIds.has(p.id));
                const spent = roster.reduce((s, p) => s + (Number(p.sold_price) || 0), 0);
                const remaining = t.purse_total - spent;
                const pct = Math.min(100, (spent / t.purse_total) * 100);
                return (
                  <div key={t.id} className="flex flex-col rounded-2xl border border-border bg-surface p-4">
                    {/* header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold leading-tight">{t.name}</div>
                      <span className="shrink-0 rounded-full bg-wash px-2 py-0.5 text-xs font-medium tabular-nums text-muted">
                        {roster.length} <span className="text-[10px]">players</span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wash">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: remaining < 0 ? "var(--down)" : "var(--accent)" }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted">
                      <span>{inr(spent)} spent</span>
                      <span className={remaining < 0 ? "text-down font-medium" : ""}>{inr(remaining)} left</span>
                    </div>

                    {roster.length === 0 ? (
                      <div className="mt-4 flex-1 py-6 text-center text-xs text-muted">No players yet</div>
                    ) : (
                      <>
                        {/* ranked groups */}
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3">
                          <RankedGroup label="Top Batters" accent="bat" list={batTop} />
                          <RankedGroup label="Top Bowlers" accent="bowl" list={bowlTop} />
                        </div>

                        {/* rest of squad as chips */}
                        {rest.length > 0 && (
                          <div className="mt-3 border-t border-border pt-3">
                            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                              Rest of squad · {rest.length}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {rest.map((p) => (
                                <span
                                  key={p.id}
                                  className="rounded-md bg-wash px-1.5 py-0.5 text-[11px] leading-tight text-ink"
                                  title={p.overall_rank != null ? `Overall pool rank #${p.overall_rank}` : undefined}
                                >
                                  {p.full_name}
                                  <Tags p={p} />
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
