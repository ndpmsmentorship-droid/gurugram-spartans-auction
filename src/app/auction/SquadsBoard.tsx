"use client";

import { useEffect, useMemo, useState } from "react";
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
// ₹74,03,000 -> ₹74.03L. Lakhs, because that's how the room talks about spend.
const inrL = (n: number) =>
  "₹" + (Math.round((n || 0) / 1000) / 100).toFixed(2) + "L";

const DIVISIONS = ["Elite", "Challengers", "Fighters"];

export default function SquadsBoard({
  teams,
  players,
  poolSize,
}: {
  teams: BoardTeam[];
  players: BoardPlayer[];
  poolSize?: number;
}) {
  const router = useRouter();
  const [division, setDivision] = useState<string>("All");
  const [query, setQuery] = useState("");

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

  // Which divisions actually have teams — no empty filter pills.
  const divisions = useMemo(
    () => DIVISIONS.filter((d) => teams.some((t) => t.division === d)),
    [teams]
  );

  const q = query.trim().toLowerCase();
  const shownTeams = teams.filter((t) => {
    if (division !== "All" && t.division !== division) return false;
    if (!q) return true;
    if (t.name.toLowerCase().includes(q)) return true;
    return rosterOf(t.id).some((p) => p.full_name.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="eyebrow">Auction day</p>
          <h1 className="mt-3 font-display text-[3rem] leading-[0.95]">Live Squads</h1>
          <p className="mt-3 max-w-md text-[0.875rem] text-muted">
            Updates the moment a player is sold.{" "}
            <span className="text-red">R</span> = retained ·{" "}
            <span className="text-red">O</span> = owner · #n = overall rank.
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={String(totalSold)} label="Players sold" />
          <Stat
            value={poolSize != null ? String(Math.max(0, poolSize - totalSold)) : "—"}
            label="Still available"
          />
          <Stat value={inrL(totalSpend)} label="Total spend" accent />
          <Stat value={String(teams.length)} label="Teams" />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-line pt-6">
        <span className="label-mono mr-1">Division</span>
        {divisions.map((d) => (
          <button
            key={d}
            onClick={() => setDivision(d)}
            data-active={division === d}
            className="pill"
          >
            {d}
          </button>
        ))}
        <button
          onClick={() => setDivision("All")}
          data-active={division === "All"}
          className="pill"
        >
          All {teams.length}
        </button>
        <div className="relative ml-auto min-w-[15rem]">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[0.875rem] text-faint">
            ⌕
          </span>
          <input
            className="input with-icon"
            placeholder="Find a player or team…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {shownTeams.map((t) => (
          <TeamCard key={t.id} team={t} roster={rosterOf(t.id)} highlight={q} />
        ))}
      </div>

      {shownTeams.length === 0 && (
        <p className="py-16 text-center text-[0.875rem] text-muted">
          No teams match “{query}”.
        </p>
      )}
    </div>
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-[8.5rem] rounded-[12px] border border-line bg-surface px-5 py-4">
      <p
        className={`font-display text-[1.75rem] leading-none ${accent ? "text-red" : "text-ink"}`}
      >
        {value}
      </p>
      <p className="label-mono mt-2">{label}</p>
    </div>
  );
}

function TeamCard({
  team,
  roster,
  highlight,
}: {
  team: BoardTeam;
  roster: BoardPlayer[];
  highlight: string;
}) {
  const spent = roster.reduce((s, p) => s + (Number(p.sold_price) || 0), 0);
  const remaining = team.purse_total - spent;
  const pct = Math.min(100, (spent / Math.max(1, team.purse_total)) * 100);

  return (
    <div className="flex flex-col overflow-hidden rounded-[12px] border border-line bg-surface">
      {/* blush header block, per the design comp */}
      <div
        className="px-4 pb-4 pt-4"
        style={{
          background:
            "linear-gradient(160deg, var(--blush-a) 0%, var(--blush-b) 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-9 w-8 shrink-0 items-center justify-center rounded-[3px_3px_12px_12px] border border-line text-[0.5rem] text-faint"
              style={{
                background:
                  "repeating-linear-gradient(135deg, rgba(37,2,1,.07) 0 5px, transparent 5px 10px)",
              }}
              aria-hidden
            >
              LOGO
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-[1.063rem] leading-none">
                {team.name}
              </p>
              <p className="label-mono mt-1.5 truncate">
                {team.division ?? "—"} · {roster.length} players
              </p>
            </div>
          </div>
          <span className="font-display text-[1.5rem] leading-none">{roster.length}</span>
        </div>

        <div className="rail mt-3.5">
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex justify-between gap-2">
          <span className="num text-[0.688rem] text-muted">{inr(spent)} spent</span>
          <span
            className={`num text-[0.688rem] ${remaining < 0 ? "font-medium text-down" : "text-red"}`}
          >
            {inr(remaining)} left
          </span>
        </div>
      </div>

      <ul className="flex-1 divide-y divide-line">
        {roster.length === 0 ? (
          <li className="px-4 py-8 text-center text-[0.75rem] text-muted">
            No players yet
          </li>
        ) : (
          roster.map((p) => {
            const hit =
              highlight && p.full_name.toLowerCase().includes(highlight);
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 px-4 py-2"
                style={hit ? { background: "var(--gold-fill)" } : undefined}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {p.overall_rank != null && (
                    <span
                      className="num shrink-0 text-[0.688rem] text-faint"
                      title="Overall rank in the pool (1 = best)"
                    >
                      #{p.overall_rank}
                    </span>
                  )}
                  <span className="truncate text-[0.875rem] text-ink">
                    {p.full_name}
                  </span>
                  {p.acquired === "retained" && (
                    <span className="num shrink-0 text-[0.594rem] text-red" title="Retained">
                      R
                    </span>
                  )}
                  {p.acquired === "owner" && (
                    <span className="num shrink-0 text-[0.594rem] text-red" title="Owner">
                      O
                    </span>
                  )}
                </span>
                <span className="num shrink-0 text-[0.813rem] text-ink">
                  {inr(Number(p.sold_price) || 0)}
                </span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
