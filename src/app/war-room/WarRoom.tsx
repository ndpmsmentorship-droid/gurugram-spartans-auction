"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlayerPhoto } from "@/app/register/PlayerCard";
import { catLabel, normCategory, type AuctionCategory } from "@/lib/scout/tier";
import { DEFAULT_RULES, inr, usclACap } from "@/lib/auction/rules";
import type { League } from "@/lib/league";
import phaseData from "@/data/phase-stats.json";
import cvMap from "@/data/cv-map.json";

export type WRTeam = { id: string; name: string; purse_total: number };
export type WRPlayer = {
  id: string;
  full_name: string;
  photo_url: string | null;
  age: number | null;
  primary_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  is_keeper: boolean | null;
  auction_category: string | null;
  bat_matches: number | null;
  runs: number | null;
  bat_avg: number | null;
  bat_sr: number | null;
  wickets: number | null;
  economy: number | null;
  bowl_sr: number | null;
  bat_index: number | null;
  bowl_index: number | null;
  overall_index: number | null;
  team_id: string | null;
  sold_price: number | null;
  acquired: string | null;
  is_rejected: boolean | null;
};
type Lot = { player_id: string | null; current_bid: number | null; base_price: number | null; leading_team_id: string | null };

// ---- player tags ---------------------------------------------------------
type Phase = { balls: number; runs: number; wkts: number; econ: number | null };
type PhaseRow = { team: string; matches: number; pp: Phase; mid: Phase; death: Phase };
const PHASES = phaseData as unknown as { matches: number; bowlers: Record<string, PhaseRow>; top: { pp: string[]; death: string[] } };
const CV = cvMap as Record<string, { batter?: string; bowler?: string }>;

type BowlTag = "Left-arm pace" | "Left-arm spin" | "Right-arm pace" | "Off-spin" | "Leg-spin";
const BOWL_TAGS: BowlTag[] = ["Left-arm pace", "Left-arm spin", "Right-arm pace", "Off-spin", "Leg-spin"];
function bowlTag(style: string | null): BowlTag | null {
  const s = (style ?? "").toLowerCase();
  if (!s || /n\/a|no bowling/.test(s)) return null;
  if (s.includes("left")) return /orthodox|chinaman|spin|slow/.test(s) ? "Left-arm spin" : "Left-arm pace";
  if (/leg|googly|wrist/.test(s)) return "Leg-spin";
  if (/off|spin/.test(s)) return "Off-spin";
  return "Right-arm pace";
}
const isPace = (t: BowlTag | null) => t === "Left-arm pace" || t === "Right-arm pace";
const isSpin = (t: BowlTag | null) => !!t && !isPace(t);

type Enriched = WRPlayer & {
  cat: AuctionCategory;
  tag: BowlTag | null;
  lhb: boolean;
  phase: PhaseRow | null;
  starDeath: boolean;
  starPP: boolean;
  deathSpec: boolean;
  ppSpec: boolean;
  clips: string | null;
};

function enrich(p: WRPlayer): Enriched {
  const lib = CV[p.full_name];
  const phase = lib?.bowler ? PHASES.bowlers[lib.bowler] ?? null : null;
  const starDeath = !!lib?.bowler && PHASES.top.death.includes(lib.bowler);
  const starPP = !!lib?.bowler && PHASES.top.pp.includes(lib.bowler);
  const d = phase?.death, pp = phase?.pp;
  const kind = lib?.bowler ? "bowler" : lib?.batter ? "batter" : null;
  return {
    ...p,
    cat: normCategory(p.auction_category) ?? "B",
    tag: bowlTag(p.bowling_style),
    lhb: /left/i.test(p.batting_style ?? ""),
    phase,
    starDeath,
    starPP,
    deathSpec: starDeath || (!!d && d.balls >= 12 && (d.econ ?? 99) <= 8.5),
    ppSpec: starPP || (!!pp && pp.balls >= 18 && (pp.econ ?? 99) <= 7),
    clips: kind ? `https://www.ndpms.in/spartans/?p=${kind}-${encodeURIComponent(lib![kind]!)}` : null,
  };
}

// ---- squad needs -----------------------------------------------------------
type Need = { key: string; label: string; target: number; test: (p: Enriched) => boolean; rank: (a: Enriched, b: Enriched) => number };
const byIdx = (k: "bat_index" | "bowl_index" | "overall_index") => (a: Enriched, b: Enriched) => (b[k] ?? -1) - (a[k] ?? -1);
const byPhase = (ph: "death" | "pp") => (a: Enriched, b: Enriched) =>
  (a.phase?.[ph]?.econ ?? 99) - (b.phase?.[ph]?.econ ?? 99) || (b.bowl_index ?? -1) - (a.bowl_index ?? -1);
const NEEDS: Need[] = [
  { key: "death", label: "Death bowlers", target: 2, test: (p) => p.deathSpec, rank: byPhase("death") },
  { key: "pp", label: "Powerplay bowlers", target: 2, test: (p) => p.ppSpec, rank: byPhase("pp") },
  { key: "pace", label: "Pace bowlers", target: 4, test: (p) => isPace(p.tag), rank: byIdx("bowl_index") },
  { key: "spin", label: "Spinners", target: 3, test: (p) => isSpin(p.tag), rank: byIdx("bowl_index") },
  { key: "left", label: "Left-arm bowlers", target: 2, test: (p) => p.tag === "Left-arm pace" || p.tag === "Left-arm spin", rank: byIdx("bowl_index") },
  { key: "wk", label: "Wicket-keepers", target: 2, test: (p) => !!p.is_keeper || /keep/i.test(p.primary_role ?? ""), rank: byIdx("bat_index") },
  { key: "lhb", label: "Left-hand bats", target: 2, test: (p) => p.lhb, rank: byIdx("bat_index") },
  { key: "hit", label: "Power hitters (SR 150+)", target: 3, test: (p) => (p.bat_sr ?? 0) >= 150 && (p.runs ?? 0) >= 1000, rank: (a, b) => (b.bat_sr ?? 0) - (a.bat_sr ?? 0) },
];

const R = DEFAULT_RULES;

export default function WarRoom(props: {
  league: League;
  leagueName: string;
  seasonId: string;
  myTeamId: string;
  canSwitch: boolean;
  teams: WRTeam[];
  players: WRPlayer[];
  initialLot: Lot;
}) {
  const [players, setPlayers] = useState(props.players);
  const [lot, setLot] = useState<Lot>(props.initialLot);
  const [myTeamId, setMyTeamId] = useState(props.myTeamId);
  const [synced, setSynced] = useState<number | null>(null);

  // Live: realtime for speed, a 5 s poll as the safety net for venue wifi.
  useEffect(() => {
    const sb = createClient();
    let alive = true;
    const pull = async () => {
      const [sold, lotRow] = await Promise.all([
        sb.from("scout_players").select("id, team_id, sold_price, acquired").not("team_id", "is", null),
        sb.from("auction_lot").select("player_id, status, current_bid, base_price, leading_team_id").eq("season_id", props.seasonId).maybeSingle(),
      ]);
      if (!alive) return;
      if (sold.data) {
        const m = new Map((sold.data as unknown as { id: string; team_id: string; sold_price: number; acquired: string }[]).map((r) => [r.id, r]));
        setPlayers((ps) =>
          ps.map((p) => {
            const s = m.get(p.id);
            const team_id = s?.team_id ?? null;
            const sold_price = s?.sold_price ?? null;
            return p.team_id === team_id && p.sold_price === sold_price ? p : { ...p, team_id, sold_price, acquired: s?.acquired ?? p.acquired };
          })
        );
      }
      const l = lotRow.data as (Lot & { status: string }) | null;
      if (l) setLot({ player_id: l.status === "live" ? l.player_id : null, current_bid: l.current_bid, base_price: l.base_price, leading_team_id: l.leading_team_id });
      setSynced(Date.now());
    };
    const id = setInterval(pull, 5000);
    const ch = sb
      .channel("war-room")
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_lot" }, () => pull())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "scout_players" }, () => pull())
      .subscribe();
    return () => {
      alive = false;
      clearInterval(id);
      sb.removeChannel(ch);
    };
  }, [props.seasonId]);

  const all = useMemo(() => players.map(enrich), [players]);
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  const available = useMemo(() => all.filter((p) => !p.team_id), [all]);

  // Every team's purse and category counts — powers "who can still bid".
  const teamState = useMemo(() => {
    const m = new Map<string, { spent: number; size: number; cats: Record<AuctionCategory, number> }>();
    for (const t of props.teams) m.set(t.id, { spent: 0, size: 0, cats: { "A+": 0, A: 0, B: 0, Special: 0 } });
    for (const p of all) {
      const s = p.team_id ? m.get(p.team_id) : null;
      if (!s) continue;
      s.spent += p.sold_price ?? 0;
      s.size += 1;
      s.cats[p.cat] += 1;
    }
    return m;
  }, [all, props.teams]);

  const myTeam = props.teams.find((t) => t.id === myTeamId)!;
  const mine = all.filter((p) => p.team_id === myTeamId);
  const me = teamState.get(myTeamId)!;
  const purseLeft = myTeam.purse_total - me.spent;
  const stillNeed = Math.max(0, R.squadMin - me.size);

  function catRoom(state: { cats: Record<AuctionCategory, number>; size: number }, cat: AuctionCategory): boolean {
    if (state.size >= R.squadMax) return false;
    if (props.league === "uscl") {
      const ap = state.cats["A+"], a = state.cats.A;
      if (cat === "A+") return ap < 2 && a <= usclACap(ap + 1);
      if (cat === "A") return a < usclACap(ap);
      if (cat === "Special") return state.cats.Special < 1;
      return true;
    }
    return state.cats[cat] < R.cap[cat];
  }
  // Highest we can pay for one player and still fill the minimum squad at B base.
  const maxSafe = Math.max(0, purseLeft - Math.max(0, stillNeed - 1) * R.base.B);
  const affordable = (p: Enriched) => R.base[p.cat] <= maxSafe && catRoom(me, p.cat);

  const needs = NEEDS.map((n) => {
    const have = mine.filter(n.test).length;
    const picks = have >= n.target ? [] : available.filter((p) => n.test(p) && affordable(p)).sort(n.rank).slice(0, 5);
    return { ...n, have, picks };
  });

  const onBlock = lot.player_id ? byId.get(lot.player_id) ?? null : null;
  const bid = lot.current_bid ?? lot.base_price ?? (onBlock ? R.base[onBlock.cat] : 0);
  const nextBid = lot.current_bid != null ? lot.current_bid + R.minIncrement : bid;
  const rivals = onBlock
    ? props.teams
        .filter((t) => t.id !== myTeamId)
        .map((t) => ({ t, s: teamState.get(t.id)! }))
        .filter(({ t, s }) => t.purse_total - s.spent >= nextBid && catRoom(s, onBlock.cat))
        .sort((a, b) => b.t.purse_total - b.s.spent - (a.t.purse_total - a.s.spent))
    : [];
  const alternatives = onBlock
    ? available
        .filter((p) => p.id !== onBlock.id && (onBlock.tag ? p.tag === onBlock.tag : p.primary_role === onBlock.primary_role) && affordable(p))
        .sort(byIdx("overall_index"))
        .slice(0, 3)
    : [];
  const fills = onBlock ? needs.filter((n) => n.have < n.target && n.test(onBlock)).map((n) => n.label) : [];

  // ---- pool browser state ----
  const [q, setQ] = useState("");
  const [tagF, setTagF] = useState<string>("");
  const [catF, setCatF] = useState<string>("");
  const [onlyAvail, setOnlyAvail] = useState(true);
  const [limit, setLimit] = useState(40);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all
      .filter((p) => (!onlyAvail || !p.team_id) && (!catF || p.cat === catF) && (!t || p.full_name.toLowerCase().includes(t)))
      .filter((p) =>
        !tagF ? true
        : tagF === "death" ? p.starDeath || p.deathSpec
        : tagF === "pp" ? p.starPP || p.ppSpec
        : tagF === "wk" ? !!p.is_keeper
        : tagF === "clips" ? !!p.clips
        : p.tag === tagF
      )
      .sort(byIdx("overall_index"));
  }, [all, q, tagF, catF, onlyAvail]);

  const catRow: [AuctionCategory, string][] = [["A+", `max ${R.cap["A+"]}`], ["A", `max ${props.league === "uscl" ? usclACap(me.cats["A+"]) : R.cap.A}`], ["B", props.league === "uscl" ? `min ${me.cats["A+"] >= 2 ? 7 : 6}` : `max ${R.cap.B}`], ["Special", `max ${R.cap.Special}`]];

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-3 py-5 sm:px-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">War room · {props.leagueName}</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">{myTeam.name}</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          {props.canSwitch && (
            <select className="input !w-auto !py-1.5 text-sm" value={myTeamId} onChange={(e) => setMyTeamId(e.target.value)} aria-label="Team">
              {props.teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-up" /> live{synced ? ` · ${new Date(synced).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
          </span>
        </div>
      </div>

      {/* tiles */}
      <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Tile k="Purse left" v={inr(purseLeft)} sub={`of ${inr(myTeam.purse_total)}`} strong />
        <Tile k="Max safe bid" v={inr(maxSafe)} sub={`keeps ${Math.max(0, stillNeed - 1)} slots at ${inr(R.base.B)}`} strong />
        <Tile k="Squad" v={`${me.size}`} sub={`need ${R.squadMin}–${R.squadMax}`} />
        {catRow.map(([c, rule]) => (
          <Tile key={c} k={catLabel(c)} v={`${me.cats[c]}`} sub={rule} warn={!catRoom(me, c) && c !== "B"} />
        ))}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* on the block */}
        <section className="rounded-[16px] border border-line bg-surface p-4 shadow-[var(--elev-sm)]">
          <p className="eyebrow">On the block</p>
          {!onBlock ? (
            <p className="mt-3 text-sm text-muted">Nobody yet. The next player appears here the moment they&apos;re put up.</p>
          ) : (
            <div className="mt-3">
              <div className="flex gap-4">
                <PlayerPhoto src={onBlock.photo_url} name={onBlock.full_name} className="h-28 w-24 shrink-0 rounded-[10px]" sizes="96px" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl leading-tight sm:text-3xl">{onBlock.full_name}</h2>
                  <Chips p={onBlock} />
                  <p className="num mt-2 text-sm text-muted">{statLine(onBlock)}</p>
                  <PhaseLine p={onBlock} />
                  {onBlock.clips && (
                    <a href={onBlock.clips} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-red underline underline-offset-4">
                      ▶ Watch clips
                    </a>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="label-mono">{lot.current_bid != null ? "Current bid" : "Base"}</p>
                  <p className="font-display text-4xl text-red">{inr(bid)}</p>
                  <p className={`mt-1 text-sm font-medium ${nextBid <= maxSafe ? "text-up" : "text-red"}`}>
                    {nextBid <= maxSafe ? `We can go to ${inr(maxSafe)}` : "Beyond our safe limit"}
                  </p>
                </div>
              </div>

              {fills.length > 0 && (
                <p className="mt-3 rounded-[10px] bg-[color-mix(in_srgb,var(--up)_10%,transparent)] px-3 py-2 text-sm text-up">
                  Fills our gap: <strong>{fills.join(" · ")}</strong>
                </p>
              )}
              {!catRoom(me, onBlock.cat) && (
                <p className="mt-3 rounded-[10px] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] px-3 py-2 text-sm text-red-deep">
                  We have no {catLabel(onBlock.cat)} slot left for him.
                </p>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="label-mono">Can still bid ({rivals.length})</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {rivals.slice(0, 6).map(({ t, s }) => (
                      <li key={t.id} className="flex justify-between gap-2">
                        <span className="truncate">{t.name}</span>
                        <span className="num text-muted">{inr(t.purse_total - s.spent)}</span>
                      </li>
                    ))}
                    {rivals.length === 0 && <li className="text-muted">No other team can afford the next bid.</li>}
                  </ul>
                </div>
                <div>
                  <p className="label-mono">If we lose him</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {alternatives.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{p.full_name}</span>
                        <span className="num shrink-0 text-muted">{catLabel(p.cat)} · {num(p.overall_index)}</span>
                      </li>
                    ))}
                    {alternatives.length === 0 && <li className="text-muted">No similar player left that we can afford.</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* needs */}
        <section className="rounded-[16px] border border-line bg-surface p-4 shadow-[var(--elev-sm)]">
          <p className="eyebrow">What we need next</p>
          <ul className="mt-3 divide-y divide-line">
            {needs.map((n) => (
              <li key={n.key} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{n.label}</span>
                  <span className={`num text-sm ${n.have >= n.target ? "text-up" : "text-red"}`}>
                    {n.have}/{n.target} {n.have >= n.target ? "✓" : ""}
                  </span>
                </div>
                {n.picks.length > 0 && (
                  <p className="mt-1 text-[0.8rem] leading-relaxed text-muted">
                    {n.picks.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && " · "}
                        <span className="text-ink">{p.full_name}</span> <span className="num">({catLabel(p.cat)}{phaseHint(p, n.key)})</span>
                      </span>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.7rem] text-faint">
            ★ phase stars: top 10 by economy in {PHASES.matches} SARDA S6 + USCL E1 matches (CricHeroes AI commentary). Suggestions are players still available that fit our category slots and our max safe bid.
          </p>
        </section>
      </div>

      {/* our squad */}
      <section className="mt-5 rounded-[16px] border border-line bg-surface p-4 shadow-[var(--elev-sm)]">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">Our squad · {mine.length}</p>
          <p className="num text-sm text-muted">spent {inr(me.spent)}</p>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {mine
            .sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0))
            .map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-[10px] border border-line p-2">
                <PlayerPhoto src={p.photo_url} name={p.full_name} className="h-10 w-10 shrink-0 rounded-full" sizes="40px" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.full_name}</p>
                  <p className="truncate text-[0.72rem] text-muted">{[catLabel(p.cat), p.tag, p.acquired === "owner" ? "Owner" : p.acquired === "retained" ? "Retained" : null].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="num text-sm">{inr(p.sold_price)}</span>
              </li>
            ))}
        </ul>
      </section>

      {/* pool */}
      <section className="mt-5 rounded-[16px] border border-line bg-surface p-4 shadow-[var(--elev-sm)]">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow mr-2">Pool</p>
          <input className="input !w-48 !py-1.5 text-sm" placeholder="Search name" value={q} onChange={(e) => { setQ(e.target.value); setLimit(40); }} />
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} className="accent-[var(--red-deep)]" /> available only
          </label>
          <span className="num ml-auto text-xs text-muted">{shown.length} players</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[["", "All"], ["death", "★ Death"], ["pp", "★ Powerplay"], ...BOWL_TAGS.map((t) => [t, t]), ["wk", "Keepers"], ["clips", "▶ Has clips"]].map(([k, l]) => (
            <button key={k} type="button" className="pill !px-3 !py-1.5" data-active={tagF === k} onClick={() => { setTagF(k); setLimit(40); }}>
              {l}
            </button>
          ))}
          <span className="mx-1 w-px bg-line" />
          {(["", "A+", "A", "B", "Special"] as const).map((c) => (
            <button key={c} type="button" className="pill !px-3 !py-1.5" data-active={catF === c} onClick={() => { setCatF(c); setLimit(40); }}>
              {c ? catLabel(c) : "Any category"}
            </button>
          ))}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left">
                {["Player", "Cat", "Bowling", "Mat", "Runs", "Avg", "SR", "Wkts", "Econ", "PP econ", "Death econ", "Index", ""].map((h) => (
                  <th key={h} className="label-mono border-b border-line px-2 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, limit).map((p) => (
                <tr key={p.id} className={`border-b border-line ${p.id === lot.player_id ? "bg-[color-mix(in_srgb,var(--red)_7%,transparent)]" : ""} ${p.team_id ? "opacity-50" : ""}`}>
                  <td className="px-2 py-1.5">
                    <span className="font-medium">{p.full_name}</span>
                    {p.starDeath && <span className="ml-1 text-gold" title="Top 10 death bowler">★D</span>}
                    {p.starPP && <span className="ml-1 text-gold" title="Top 10 powerplay bowler">★P</span>}
                    {p.team_id && <span className="ml-1 text-[0.7rem] text-muted">· {props.teams.find((t) => t.id === p.team_id)?.name} {inr(p.sold_price)}</span>}
                  </td>
                  <td className="px-2">{catLabel(p.cat)}</td>
                  <td className="px-2 text-muted">{p.tag ?? "—"}{p.is_keeper ? " · WK" : ""}</td>
                  <td className="num px-2">{num(p.bat_matches)}</td>
                  <td className="num px-2">{num(p.runs)}</td>
                  <td className="num px-2">{num(p.bat_avg)}</td>
                  <td className="num px-2">{num(p.bat_sr)}</td>
                  <td className="num px-2">{num(p.wickets)}</td>
                  <td className="num px-2">{num(p.economy)}</td>
                  <td className="num px-2">{p.phase?.pp.balls ? `${p.phase.pp.econ} (${p.phase.pp.balls}b)` : "—"}</td>
                  <td className="num px-2">{p.phase?.death.balls ? `${p.phase.death.econ} (${p.phase.death.balls}b)` : "—"}</td>
                  <td className="num px-2 font-medium">{num(p.overall_index)}</td>
                  <td className="px-2">{p.clips && <a href={p.clips} target="_blank" rel="noopener noreferrer" className="text-red" title="Watch clips">▶</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length > limit && (
          <button type="button" className="btn-ghost mt-3" onClick={() => setLimit((l) => l + 60)}>
            Show more ({shown.length - limit})
          </button>
        )}
      </section>
    </main>
  );
}

const num = (v: number | null | undefined) => (v == null ? "—" : String(Math.round(v * 10) / 10));
const statLine = (p: Enriched) =>
  [p.bat_matches != null && `${p.bat_matches} mat`, p.runs != null && `${p.runs} runs`, p.bat_sr != null && `SR ${num(p.bat_sr)}`, p.wickets != null && `${p.wickets} wkts`, p.economy != null && `econ ${num(p.economy)}`]
    .filter(Boolean)
    .join(" · ");
const phaseHint = (p: Enriched, key: string) =>
  key === "death" && p.phase?.death.econ != null ? ` · ${p.phase.death.econ}` : key === "pp" && p.phase?.pp.econ != null ? ` · ${p.phase.pp.econ}` : "";

function Tile({ k, v, sub, strong, warn }: { k: string; v: string; sub?: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-[12px] border px-3 py-2.5 ${warn ? "border-red/50 bg-[color-mix(in_srgb,var(--red)_6%,transparent)]" : "border-line bg-surface"}`}>
      <p className="label-mono">{k}</p>
      <p className={`mt-1 font-display ${strong ? "text-2xl text-red" : "text-xl"}`}>{v}</p>
      {sub && <p className="text-[0.68rem] text-muted">{sub}</p>}
    </div>
  );
}

function Chips({ p }: { p: Enriched }) {
  const chips = [catLabel(p.cat), p.primary_role, p.tag, p.is_keeper ? "Keeper" : null, p.lhb ? "Left-hand bat" : null, p.age ? `${p.age} yrs` : null].filter(Boolean);
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c as string} className="badge bg-wash text-ink">{c}</span>
      ))}
      {p.starDeath && <span className="badge bg-gold-fill text-gold">★ Top-10 death</span>}
      {p.starPP && <span className="badge bg-gold-fill text-gold">★ Top-10 powerplay</span>}
    </div>
  );
}

function PhaseLine({ p }: { p: Enriched }) {
  if (!p.phase) return null;
  const f = (label: string, s: Phase) => (s.balls ? `${label} ${s.econ} econ · ${s.wkts}w in ${s.balls}b` : null);
  const parts = [f("PP", p.phase.pp), f("Middle", p.phase.mid), f("Death", p.phase.death)].filter(Boolean);
  return parts.length ? <p className="num mt-1 text-[0.78rem] text-muted">SARDA/USCL phases: {parts.join(" · ")}</p> : null;
}
