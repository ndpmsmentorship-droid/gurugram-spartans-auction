"use client";

import Image from "next/image";
import { useLotSync } from "@/app/auction/useLotSync";
import { PlayerPhoto } from "@/app/register/PlayerCard";
import { inr } from "@/lib/auction/rules";
import { catLabel, normCategory } from "@/lib/scout/tier";
import type { BoardData, ScreenTeam } from "@/lib/auction/board-data";
import { TITLE_SPONSOR, PRESENTED_BY, PARTNERS, logoSize } from "@/app/sponsors";
import sdllCrest from "@/app/brand/crest.png";
import playfulWhite from "@/app/brand/playful-ventures-white.png";
import Crest from "./Crest";

// The hall screen, built from the USCL dry run's official screen (4 Oct):
// header with the lot number, the player on the block, the bid, every purse,
// up next + recent sales, and the sponsors. Everything is sized off the
// viewport WIDTH (vw) so the same page reads on a laptop and a 4 m projector.

export const CAT_COLOUR: Record<string, string> = {
  "A+": "#E8B64C",
  A: "#F0564A",
  B: "#7FA6E8",
  Special: "#8FD3A2",
};
const catColour = (c: string | null | undefined) => CAT_COLOUR[normCategory(c) ?? "B"] ?? "#fff";

const n = (v: number | null | undefined, d = 0) =>
  v == null ? "—" : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-IN");

export default function BigScreen({ board }: { board: BoardData }) {
  useLotSync(3000);
  const { lot, player, teams } = board;
  const byId = new Map(teams.map((t) => [t.id, t]));
  const leader = lot.leading_team_id ? byId.get(lot.leading_team_id) : undefined;
  const live = lot.status === "live";
  const sold = lot.status === "sold";
  const onBlock = !!player && lot.status !== "idle";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden text-white"
      style={{ background: "radial-gradient(120% 90% at 30% 20%, #4d1310 0%, #2a0806 45%, #140302 100%)" }}
    >
      <style>{`
        @keyframes bs-bump { 0% { transform: scale(1.12); color: #FFD27A } 100% { transform: scale(1); } }
        @keyframes bs-in { from { opacity: 0; transform: translateY(1vw) } to { opacity: 1; transform: none } }
        @keyframes bs-stamp { 0% { opacity: 0; transform: rotate(-8deg) scale(1.6) } 100% { opacity: 1; transform: rotate(-8deg) scale(1) } }
        .bs-bump { animation: bs-bump .45s ease-out }
        .bs-in { animation: bs-in .5s ease-out both }
        .bs-stamp { animation: bs-stamp .35s cubic-bezier(.2,1.4,.4,1) both }
      `}</style>

      <Header board={board} />

      {/* ---- main: player · bid · queue ---- */}
      <div className="grid min-h-0 flex-1 gap-[1.2vw] px-[1.6vw] pt-[1.1vw]" style={{ gridTemplateColumns: "1.35fr 1fr 0.78fr" }}>
        <section className="relative min-h-0 overflow-hidden rounded-[1vw] border border-white/10 bg-white/[0.04]">
          {onBlock && player ? <PlayerPanel key={player.id} board={board} /> : <Waiting board={board} />}
        </section>

        <section
          className="relative flex min-h-0 flex-col overflow-hidden rounded-[1vw] border p-[1.4vw]"
          style={{
            borderColor: sold ? "#3fb27f" : live ? "rgba(240,86,74,.55)" : "rgba(255,255,255,.1)",
            background: sold
              ? "linear-gradient(160deg, rgba(46,125,80,.45), rgba(20,60,40,.35))"
              : live
                ? "linear-gradient(160deg, rgba(177,37,32,.32), rgba(87,15,12,.18))"
                : "rgba(255,255,255,.04)",
          }}
        >
          <BidPanel board={board} leader={leader} />
        </section>

        <aside className="flex min-h-0 flex-col gap-[1.1vw]">
          <UpNext board={board} />
          <Recent board={board} byId={byId} />
        </aside>
      </div>

      {/* ---- every purse ---- */}
      <Purses teams={teams} leaderId={live ? lot.leading_team_id : null} soldTo={sold ? lot.leading_team_id : null} squadMax={board.squadMax} />

      <Sponsors />

      <FullscreenButton />
    </div>
  );
}

function Header({ board }: { board: BoardData }) {
  const live = board.lot.status === "live";
  return (
    <header className="flex shrink-0 items-center justify-between gap-[2vw] border-b-2 border-[#b12520] bg-black/30 px-[1.6vw] py-[0.7vw]">
      <div className="flex items-center gap-[0.9vw]">
        <Image src={sdllCrest} alt="" className="h-[3.4vw] w-auto" priority />
        <div className="leading-none">
          <p className="font-display text-[1.7vw] font-bold uppercase tracking-[0.03em]">Shanti Devi Legend League</p>
          <p className="mt-[0.35vw] font-mono text-[0.72vw] uppercase tracking-[0.3em] text-white/60">Season 2 · Player Auction</p>
        </div>
      </div>

      <div className="flex items-center gap-[1.2vw]">
        <span className="font-display text-[2.2vw] font-bold leading-none tracking-[0.04em]">
          LOT <span className="text-[#F0564A]">#{Math.max(board.lotNo, 0)}</span>
        </span>
        {live ? (
          <span className="inline-flex items-center gap-[0.5vw] rounded-full bg-[#b12520] px-[1vw] py-[0.4vw] font-mono text-[0.85vw] font-semibold uppercase tracking-[0.2em]">
            <span className="relative flex h-[0.6vw] w-[0.6vw]">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-[0.6vw] w-[0.6vw] rounded-full bg-white" />
            </span>
            Live
          </span>
        ) : (
          <span className="rounded-full border border-white/20 px-[1vw] py-[0.4vw] font-mono text-[0.85vw] uppercase tracking-[0.2em] text-white/60">
            {board.lot.status === "sold" ? "Sold" : board.lot.status === "unsold" ? "Unsold" : "Break"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-[1.6vw]">
        <HeadStat label="Sold" value={board.sold} />
        <HeadStat label="Unsold" value={board.unsold} />
        <span className="flex items-center gap-[0.6vw] border-l border-white/15 pl-[1.4vw]">
          <span className="font-mono text-[0.55vw] uppercase leading-tight tracking-[0.22em] text-white/50">
            Presented
            <br />
            by
          </span>
          <Image src={playfulWhite} alt="Playful Ventures" className="h-[2.4vw] w-auto" />
        </span>
      </div>
    </header>
  );
}

function HeadStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-center leading-none">
      <span className="block font-display text-[1.6vw] font-bold">{value}</span>
      <span className="mt-[0.25vw] block font-mono text-[0.6vw] uppercase tracking-[0.2em] text-white/55">{label}</span>
    </span>
  );
}

function PlayerPanel({ board }: { board: BoardData }) {
  const p = board.player!;
  const cat = normCategory(p.auction_category);
  const style = [p.batting_style, p.bowling_style].filter(Boolean).join(" · ");
  return (
    <div className="bs-in flex h-full gap-[1.6vw] p-[1.4vw]">
      <div className="relative flex w-[38%] shrink-0 flex-col">
        <PlayerPhoto
          src={p.photo_url}
          name={p.full_name}
          className="h-full w-full rounded-[0.8vw] border border-white/15"
          sizes="40vw"
        />
        {p.is_marquee && (
          <span className="absolute left-[0.8vw] top-[0.8vw] rounded-full bg-[#E8B64C] px-[0.8vw] py-[0.3vw] font-mono text-[0.75vw] font-bold uppercase tracking-[0.16em] text-[#250201]">
            ★ Marquee
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-[0.6vw]">
          {cat && (
            <span
              className="rounded-[0.4vw] px-[0.8vw] py-[0.25vw] font-display text-[1.3vw] font-bold leading-none text-[#250201]"
              style={{ background: catColour(cat) }}
            >
              {catLabel(cat)}
            </span>
          )}
          <span className="rounded-full bg-white/10 px-[0.8vw] py-[0.35vw] font-mono text-[0.8vw] font-semibold tracking-[0.08em]">
            RANK #{p.overall_rank != null ? String(p.overall_rank).padStart(3, "0") : "—"}
          </span>
        </div>

        <h1
          className="mt-[0.9vw] font-display font-bold uppercase leading-[0.92] tracking-[0.01em]"
          style={{ fontSize: p.full_name.length > 18 ? "3.3vw" : "4.2vw" }}
        >
          {p.full_name}
        </h1>

        <p className="mt-[0.8vw] font-mono text-[0.95vw] uppercase tracking-[0.12em] text-white/75">
          {[p.primary_role, p.age != null ? `Age ${p.age}` : null].filter(Boolean).join(" · ")}
        </p>
        {style && <p className="mt-[0.3vw] text-[1vw] text-white/60">{style}</p>}

        <div className="mt-auto grid grid-cols-3 gap-[0.6vw]">
          <Stat label="Matches" value={n(p.bat_matches)} />
          <Stat label="Runs" value={n(p.runs)} />
          <Stat label="Average" value={n(p.bat_avg, 1)} />
          <Stat label="Strike rate" value={n(p.bat_sr, 1)} />
          <Stat label="Wickets" value={n(p.wickets)} />
          <Stat label="Economy" value={n(p.economy, 1)} />
        </div>
        <div className="mt-[0.6vw] flex items-center justify-between rounded-[0.6vw] bg-black/25 px-[1vw] py-[0.6vw] font-mono text-[0.8vw] uppercase tracking-[0.12em] text-white/60">
          <span>
            Bat index <b className="ml-[0.3vw] text-[1.1vw] text-[#F0564A]">{n(p.bat_index, 1)}</b>
          </span>
          <span>
            Bowl index <b className="ml-[0.3vw] text-[1.1vw] text-[#F0564A]">{n(p.bowl_index, 1)}</b>
          </span>
          <span>
            Overall <b className="ml-[0.3vw] text-[1.1vw] text-white">{n(p.overall_index, 1)}</b>
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.6vw] bg-white/[0.07] px-[0.9vw] py-[0.7vw] leading-none">
      <p className="font-display text-[2.2vw] font-bold">{value}</p>
      <p className="mt-[0.35vw] font-mono text-[0.62vw] uppercase tracking-[0.16em] text-white/55">{label}</p>
    </div>
  );
}

function Waiting({ board }: { board: BoardData }) {
  const next = board.upNext[0];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[1.2vw] text-center">
      <Image src={sdllCrest} alt="" className="h-[11vw] w-auto opacity-90" />
      <p className="font-mono text-[0.9vw] uppercase tracking-[0.35em] text-white/55">
        {board.lotNo === 0 ? "The auction starts shortly" : "Next lot coming up"}
      </p>
      {next && (
        <p className="font-display text-[2.6vw] font-bold uppercase leading-none">
          {next.full_name}
          <span className="ml-[0.8vw] align-middle font-mono text-[1vw]" style={{ color: catColour(next.auction_category) }}>
            {catLabel(next.auction_category)}
          </span>
        </p>
      )}
    </div>
  );
}

function BidPanel({ board, leader }: { board: BoardData; leader?: ScreenTeam }) {
  const { lot } = board;
  const status = lot.status;
  if (status === "idle" || !board.player) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="font-mono text-[0.9vw] uppercase tracking-[0.3em] text-white/50">Purse in play</p>
        <p className="mt-[0.6vw] font-display text-[4vw] font-bold leading-none">
          {inr(board.teams.reduce((s, t) => s + t.purse_total - t.spent, 0))}
        </p>
        <p className="mt-[0.5vw] font-mono text-[0.8vw] uppercase tracking-[0.2em] text-white/45">
          across {board.teams.length} franchises
        </p>
      </div>
    );
  }
  const amount = lot.current_bid ?? lot.base_price ?? 0;
  const label =
    status === "sold" ? "Sold for" : status === "unsold" ? "Unsold" : lot.current_bid == null ? "Awaiting bids · base" : "Current bid";

  return (
    <>
      <p
        className="font-mono text-[1vw] font-semibold uppercase tracking-[0.3em]"
        style={{ color: status === "sold" ? "#8FE3B5" : status === "unsold" ? "rgba(255,255,255,.55)" : "#F0564A" }}
      >
        {label}
      </p>
      <p
        key={`${amount}-${lot.leading_team_id}`}
        className={`mt-[0.4vw] font-display font-bold leading-[0.9] ${status === "live" ? "bs-bump" : ""}`}
        style={{ fontSize: "6.4vw", color: status === "unsold" ? "rgba(255,255,255,.45)" : "#fff" }}
      >
        {inr(amount)}
      </p>

      {/* who holds it */}
      <div className="mt-[1.1vw] flex min-h-[6vw] items-center gap-[1vw]">
        {leader ? (
          <>
            <Crest name={leader.name} logo={leader.logo} size="5.6vw" ring={status === "sold" ? "#3fb27f" : "#F0564A"} />
            <div className="min-w-0 leading-none">
              <p className="font-mono text-[0.75vw] uppercase tracking-[0.25em] text-white/55">
                {status === "sold" ? "Sold to" : "Leading"}
              </p>
              <p className="mt-[0.35vw] font-display text-[2.1vw] font-bold uppercase leading-[0.95]">{leader.name}</p>
              <p className="mt-[0.35vw] font-mono text-[0.8vw] text-white/60">
                {status === "sold"
                  ? `${inr(leader.purse_total - leader.spent)} purse left`
                  : `${inr(leader.purse_total - leader.spent - amount)} left if this stands`}
              </p>
            </div>
          </>
        ) : (
          <p className="font-display text-[1.8vw] uppercase text-white/50">
            {status === "unsold" ? "No bids — back to the pool" : "Paddles up"}
          </p>
        )}
      </div>

      {/* the ladder: who bid what, newest on top */}
      <div className="mt-[1vw] min-h-0 flex-1 overflow-hidden border-t border-white/10 pt-[0.8vw]">
        <p className="font-mono text-[0.65vw] uppercase tracking-[0.22em] text-white/45">
          Base {inr(lot.base_price)} · {board.bids.length} bid{board.bids.length === 1 ? "" : "s"}
        </p>
        <ul className="mt-[0.5vw] flex flex-col gap-[0.35vw]">
          {board.bids
            .slice()
            .reverse()
            .slice(0, 6)
            .map((b, i) => {
              const t = board.teams.find((x) => x.id === b.team_id);
              return (
                <li
                  key={`${b.amount}-${b.team_id}`}
                  className="flex items-center justify-between gap-[0.6vw]"
                  style={{ opacity: 1 - i * 0.14 }}
                >
                  <span className="flex min-w-0 items-center gap-[0.5vw]">
                    {t && <Crest name={t.name} logo={t.logo} size="1.5vw" />}
                    <span className="truncate text-[0.95vw]">{t?.name ?? "—"}</span>
                  </span>
                  <span className="font-mono text-[0.95vw] font-semibold">{inr(b.amount)}</span>
                </li>
              );
            })}
        </ul>
      </div>

      {status === "sold" && (
        <span className="bs-stamp pointer-events-none absolute bottom-[1.4vw] right-[1.4vw] rounded-[0.5vw] border-[0.3vw] border-[#8FE3B5] px-[1vw] py-[0.2vw] font-display text-[3vw] font-bold uppercase tracking-[0.08em] text-[#8FE3B5]">
          Sold
        </span>
      )}
    </>
  );
}

function UpNext({ board }: { board: BoardData }) {
  return (
    <div className="rounded-[1vw] border border-white/10 bg-white/[0.04] p-[1vw]">
      <p className="font-mono text-[0.7vw] uppercase tracking-[0.28em] text-white/55">Up next</p>
      <ul className="mt-[0.6vw] flex flex-col gap-[0.45vw]">
        {board.upNext.length === 0 && <li className="text-[0.9vw] text-white/45">Pool complete</li>}
        {board.upNext.map((p, i) => (
          <li key={p.id} className="flex items-center gap-[0.6vw]" style={{ opacity: 1 - i * 0.12 }}>
            <span
              className="w-[2.4vw] shrink-0 rounded-[0.3vw] py-[0.15vw] text-center font-display text-[0.85vw] font-bold text-[#250201]"
              style={{ background: catColour(p.auction_category) }}
            >
              {catLabel(p.auction_category)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[1.05vw] font-medium">{p.full_name}</span>
            <span className="shrink-0 font-mono text-[0.7vw] text-white/45">
              {p.overall_rank != null ? `#${p.overall_rank}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Recent({ board, byId }: { board: BoardData; byId: Map<string, ScreenTeam> }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-[1vw] border border-white/10 bg-white/[0.04] p-[1vw]">
      <p className="font-mono text-[0.7vw] uppercase tracking-[0.28em] text-white/55">Recent sales</p>
      <ul className="mt-[0.6vw] flex flex-col gap-[0.5vw]">
        {board.recent.length === 0 && <li className="text-[0.9vw] text-white/45">No sales yet</li>}
        {board.recent.slice(0, 6).map((s) => {
          const t = s.team_id ? byId.get(s.team_id) : undefined;
          return (
            <li key={s.id} className="flex items-center gap-[0.6vw]">
              {t && <Crest name={t.name} logo={t.logo} size="1.8vw" />}
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[0.95vw] font-medium">{s.player}</span>
                <span className="block truncate font-mono text-[0.62vw] uppercase tracking-[0.1em] text-white/45">
                  {t?.name ?? "—"}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[0.95vw] font-semibold text-[#8FE3B5]">{inr(s.amount)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Purses({
  teams,
  leaderId,
  soldTo,
  squadMax,
}: {
  teams: ScreenTeam[];
  leaderId: string | null;
  soldTo: string | null;
  squadMax: number;
}) {
  const cols = Math.ceil(teams.length / 2);
  return (
    <div className="grid shrink-0 gap-[0.6vw] px-[1.6vw] py-[1vw]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {teams.map((t) => {
        const left = t.purse_total - t.spent;
        const hot = t.id === leaderId || t.id === soldTo;
        const colour = t.id === soldTo ? "#3fb27f" : "#F0564A";
        return (
          <div
            key={t.id}
            className="flex items-center gap-[0.6vw] rounded-[0.7vw] border px-[0.7vw] py-[0.55vw] transition-all duration-300"
            style={{
              borderColor: hot ? colour : "rgba(255,255,255,.1)",
              background: hot ? `color-mix(in srgb, ${colour} 22%, transparent)` : "rgba(255,255,255,.04)",
              boxShadow: hot ? `0 0 1.4vw -0.2vw ${colour}` : undefined,
            }}
          >
            <Crest name={t.name} logo={t.logo} size="2.6vw" />
            <div className="min-w-0 flex-1 leading-none">
              <p className="truncate text-[0.72vw] font-medium uppercase tracking-[0.04em] text-white/80">{t.name}</p>
              <p className="mt-[0.3vw] font-display text-[1.35vw] font-bold">{inr(left)}</p>
              <div className="mt-[0.3vw] h-[0.25vw] overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, (t.spent / Math.max(t.purse_total, 1)) * 100)}%`, background: colour }}
                />
              </div>
              <p className="mt-[0.3vw] font-mono text-[0.6vw] uppercase tracking-[0.1em] text-white/50">
                Squad {t.squadSize}/{squadMax}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Sponsors() {
  return (
    <footer className="flex shrink-0 items-center gap-[2vw] bg-white px-[2.2vw] py-[0.6vw] text-[#250201]">
      {[TITLE_SPONSOR, PRESENTED_BY].map((s) => {
        const sz = logoSize(s.logo, 5200, 46);
        return (
          <span key={s.name} className="flex shrink-0 items-center gap-[0.6vw]">
            <span className="font-mono text-[0.5vw] uppercase leading-tight tracking-[0.2em] text-[#250201]/55">
              {s.role.split(" ").map((w, i) => (
                <span key={i} className="block">
                  {w}
                </span>
              ))}
            </span>
            <Image src={s.logo} alt={s.name} style={{ width: `${sz.width / 19.2}vw`, height: "auto" }} />
          </span>
        );
      })}
      <span className="h-[2.4vw] w-px bg-[#250201]/15" />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-[1.2vw]">
        {PARTNERS.map((s) => {
          const sz = logoSize(s.logo, 2600, 34);
          return (
            <Image key={s.name} src={s.logo} alt={s.name} title={s.role} style={{ width: `${sz.width / 19.2}vw`, height: "auto" }} />
          );
        })}
      </div>
    </footer>
  );
}

function FullscreenButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
      }}
      className="absolute bottom-[4.2vw] right-[0.6vw] rounded-full bg-black/40 px-[0.7vw] py-[0.3vw] font-mono text-[0.6vw] uppercase tracking-[0.2em] text-white/40 opacity-0 transition hover:opacity-100"
      title="Full screen (F11 also works)"
    >
      Full screen
    </button>
  );
}
