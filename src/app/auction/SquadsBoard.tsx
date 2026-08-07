"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
};

const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const DIVISIONS = ["Elite", "Challengers", "Fighters"];

export default function SquadsBoard({ teams, players }: { teams: BoardTeam[]; players: BoardPlayer[] }) {
  const router = useRouter();

  // Live: refresh the board whenever the pool changes (admin assigns / undoes).
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("squads-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "scout_players" }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [router]);

  const rosterOf = (teamId: string) =>
    players
      .filter((p) => p.team_id === teamId)
      .sort((a, b) => (Number(b.sold_price) || 0) - (Number(a.sold_price) || 0));

  const totalSold = players.length;
  const totalSpend = players.reduce((s, p) => s + (Number(p.sold_price) || 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live Squads</h1>
          <p className="text-sm text-muted">Updates live as players are sold.</p>
        </div>
        <p className="text-sm text-muted tabular-nums">
          {totalSold} players sold · {inr(totalSpend)} spent
        </p>
      </div>

      {DIVISIONS.map((div) => {
        const divTeams = teams.filter((t) => t.division === div);
        if (divTeams.length === 0) return null;
        return (
          <section key={div}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-highlight-ink">{div}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {divTeams.map((t) => {
                const roster = rosterOf(t.id);
                const spent = roster.reduce((s, p) => s + (Number(p.sold_price) || 0), 0);
                const remaining = t.purse_total - spent;
                const pct = Math.min(100, (spent / t.purse_total) * 100);
                return (
                  <div key={t.id} className="flex flex-col rounded-xl border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold leading-tight">{t.name}</div>
                      <span className="shrink-0 rounded-full bg-wash px-2 py-0.5 text-xs tabular-nums text-muted">
                        {roster.length}
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

                    <ul className="mt-3 flex-1 space-y-1 text-sm">
                      {roster.length === 0 ? (
                        <li className="py-2 text-center text-xs text-muted">No players yet</li>
                      ) : (
                        roster.map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-2">
                            <span className="truncate">
                              {p.full_name}
                              {p.acquired === "retained" && (
                                <span className="ml-1.5 text-[10px] uppercase text-highlight-ink">R</span>
                              )}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted">{inr(Number(p.sold_price) || 0)}</span>
                          </li>
                        ))
                      )}
                    </ul>
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
