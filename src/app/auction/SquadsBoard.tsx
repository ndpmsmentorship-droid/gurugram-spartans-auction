"use client";

import { useEffect, useState } from "react";
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
};

const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const DIVISIONS = ["Elite", "Challengers", "Fighters"];

export default function SquadsBoard({ teams, players }: { teams: BoardTeam[]; players: BoardPlayer[] }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Live: re-pull the board every few seconds so spectators see sales roll in.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(id);
  }, [router]);

  // Manual pull of the latest buys/prices from the SCCL dashboard, on demand.
  async function syncNow() {
    setSyncing(true);
    setMsg(null);
    try {
      const res = await fetch("/spartansscout/api/sync-auction", { cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (j?.ok) setMsg(j.updated || j.cleared ? `Synced — ${(j.updated ?? 0) + (j.cleared ?? 0)} change(s)` : "Up to date");
      else if (j?.skipped) setMsg("Just synced — up to date");
      else setMsg("Sync failed — try again");
      router.refresh();
    } catch {
      setMsg("Sync failed — try again");
    } finally {
      setSyncing(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

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
            Updates live as players are sold. <span className="text-highlight-ink">R</span> = retained ·{" "}
            <span className="text-accent-text">O</span> = owner · #n = our overall rank
          </p>
        </div>
        <div className="flex flex-col gap-1.5 sm:items-end">
          <button
            onClick={syncNow}
            disabled={syncing}
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto sm:py-1.5"
            title="Pull the latest buys & prices from the live auction"
          >
            {syncing ? "Syncing…" : "↻ Sync now"}
          </button>
          <p className="text-sm text-muted tabular-nums">
            {totalSold} sold · {inr(totalSpend)} spent{msg ? ` · ${msg}` : ""}
          </p>
        </div>
      </div>

      {DIVISIONS.map((div) => {
        const divTeams = teams.filter((t) => t.division === div);
        if (divTeams.length === 0) return null;
        return (
          <section key={div}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-highlight-ink">{div}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                            <span className="flex min-w-0 items-center gap-1.5">
                              {p.overall_rank != null && (
                                <span
                                  className="shrink-0 tabular-nums text-[11px] font-semibold text-accent-text"
                                  title="Our Rank — position in the overall auction pool (1 = best)"
                                >
                                  #{p.overall_rank}
                                </span>
                              )}
                              <span className="truncate">
                                {p.full_name}
                                {p.acquired === "retained" && (
                                  <span className="ml-1.5 text-[10px] uppercase text-highlight-ink" title="Retained">R</span>
                                )}
                                {p.acquired === "owner" && (
                                  <span className="ml-1.5 text-[10px] uppercase text-accent-text" title="Owner">O</span>
                                )}
                              </span>
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
