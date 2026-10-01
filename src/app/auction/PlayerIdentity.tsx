"use client";

import { PlayerPhoto } from "@/app/register/PlayerCard";
import { catLabel } from "@/lib/scout/tier";
import { clipsUrl } from "@/lib/scout/clips";

// The full identity of whoever is on the block — photo, our rank/ID, and a
// compact career stat strip — so the auctioneer and the room see the SAME
// player's details automatically the moment a lot goes up. Shared by the
// admin lot card and the public board.
export type LotPlayerDetail = {
  id: string;
  full_name: string;
  auction_category: string | null;
  primary_role: string | null;
  overall_rank: number | null;
  is_marquee: boolean;
  photo_url: string | null;
  age: number | null;
  bat_matches: number | null;
  runs: number | null;
  bat_avg: number | null;
  bat_sr: number | null;
  wickets: number | null;
  economy: number | null;
  bat_index: number | null;
  bowl_index: number | null;
  overall_index: number | null;
};

const n = (v: number | null | undefined, d = 0) =>
  v == null ? "—" : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-IN");

// Our ranking assigns every player a rank; shown as a zero-padded ID badge.
export function rankId(rank: number | null): string {
  return rank == null ? "—" : "#" + String(rank).padStart(3, "0");
}

export default function PlayerIdentity({
  player,
  size = "lg",
}: {
  player: LotPlayerDetail;
  size?: "lg" | "md";
}) {
  const photo = size === "lg" ? "h-24 w-24" : "h-16 w-16";
  const nameSz = size === "lg" ? "text-[2rem]" : "text-[1.4rem]";

  return (
    <div className="flex items-start gap-4">
      {/* photo */}
      {/* photo: SARDA-hosted photos block direct embedding, so PlayerPhoto
          routes them through next/image and falls back to initials. */}
      <PlayerPhoto
        src={player.photo_url}
        name={player.full_name}
        className={`${photo} shrink-0 rounded-[12px] border border-line`}
        sizes={size === "lg" ? "96px" : "64px"}
      />

      <div className="min-w-0">
        {/* our rank / id */}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--red)_14%,transparent)] px-2.5 py-1 num text-[0.7rem] font-semibold text-red">
          <span className="uppercase tracking-[0.1em] text-[0.6rem] opacity-80">Rank</span>
          {rankId(player.overall_rank)}
        </span>

        <h2 className={`mt-2 flex items-center gap-2.5 font-display ${nameSz} leading-none`}>
          <span className="truncate">{player.full_name}</span>
          {player.is_marquee && (
            <span className="shrink-0 text-[1rem] text-gold" title="Marquee — must buy">
              ★
            </span>
          )}
        </h2>

        <p className="num mt-2 text-[0.75rem] uppercase tracking-[0.1em] text-muted">
          {[
            player.auction_category ? catLabel(player.auction_category) : null,
            player.primary_role,
            player.age != null ? `Age ${player.age}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {/* career stat strip */}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Stat label="Mat" value={n(player.bat_matches)} />
          <Stat label="Runs" value={n(player.runs)} />
          <Stat label="Avg" value={n(player.bat_avg, 1)} />
          <Stat label="SR" value={n(player.bat_sr, 1)} />
          <Stat label="Wkts" value={n(player.wickets)} />
          <Stat label="Econ" value={n(player.economy, 1)} />
          <Stat label="Bat idx" value={n(player.bat_index, 1)} accent />
          <Stat label="Bowl idx" value={n(player.bowl_index, 1)} accent />
          <Stat label="Overall" value={n(player.overall_index, 1)} accent />
        </div>

        {clipsUrl(player.full_name) && (
          <a
            href={clipsUrl(player.full_name)!}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red px-3.5 py-1.5 text-[0.8rem] font-semibold text-white hover:opacity-90"
          >
            ▶ Watch clips
          </a>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="leading-none">
      <p className={`num text-[1.05rem] font-semibold ${accent ? "text-red" : "text-ink"}`}>{value}</p>
      <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">{label}</p>
    </div>
  );
}
