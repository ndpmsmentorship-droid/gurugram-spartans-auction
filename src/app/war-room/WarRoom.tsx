"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { assignPlayer, unassignPlayer, rtmPlayer, setPurse } from "@/app/admin/auction/actions";
import { putUpLot, withdrawLot } from "@/app/admin/auction/live-actions";
import { createClient } from "@/lib/supabase/client";
import { PlayerPhoto } from "@/app/register/PlayerCard";
import TeamCrest from "@/app/TeamCrest";
import { catLabel, normCategory, type AuctionCategory } from "@/lib/scout/tier";
import { DEFAULT_RULES, inr, USCL_RETAIN, USCL_OWNER, USCL_AGE_BAND, inAgeBand, bidStep } from "@/lib/auction/rules";
import type { League } from "@/lib/league";
import phaseData from "@/data/phase-stats.json";
import cvMap from "@/data/cv-map.json";
import { clipsUrl } from "@/lib/scout/clips";
import { rtmState, rtmThreats, RTM_MAX_AGAINST } from "@/lib/auction/rtm";

export type WRTeam = { id: string; name: string; purse_total: number; purse_max?: number | null; logo_url?: string | null };
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
  rtm_against: string | null;
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
    clips: clipsUrl(p.full_name),
  };
}

// ---- squad needs -----------------------------------------------------------
type Need = { key: string; q: string; label: string; target: number; test: (p: Enriched) => boolean; rank: (a: Enriched, b: Enriched) => number };
const byIdx = (k: "bat_index" | "bowl_index" | "overall_index") => (a: Enriched, b: Enriched) => (b[k] ?? -1) - (a[k] ?? -1);
const byPhase = (ph: "death" | "pp") => (a: Enriched, b: Enriched) =>
  (a.phase?.[ph]?.econ ?? 99) - (b.phase?.[ph]?.econ ?? 99) || (b.bowl_index ?? -1) - (a.bowl_index ?? -1);
const NEEDS: Need[] = [
  { key: "death", q: "death bowlers", label: "Death bowlers", target: 2, test: (p) => p.deathSpec, rank: byPhase("death") },
  { key: "pp", q: "powerplay bowlers", label: "Powerplay bowlers", target: 2, test: (p) => p.ppSpec, rank: byPhase("pp") },
  { key: "pace", q: "pacers", label: "Pace bowlers", target: 4, test: (p) => isPace(p.tag), rank: byIdx("bowl_index") },
  { key: "spin", q: "spinners", label: "Spinners", target: 3, test: (p) => isSpin(p.tag), rank: byIdx("bowl_index") },
  { key: "left", q: "left arm bowlers", label: "Left-arm bowlers", target: 2, test: (p) => p.tag === "Left-arm pace" || p.tag === "Left-arm spin", rank: byIdx("bowl_index") },
  { key: "wk", q: "keepers", label: "Wicket-keepers", target: 2, test: (p) => !!p.is_keeper || /keep/i.test(p.primary_role ?? ""), rank: byIdx("bat_index") },
  { key: "lhb", q: "left hand bats", label: "Left-hand bats", target: 2, test: (p) => p.lhb, rank: byIdx("bat_index") },
  { key: "hit", q: "power hitters", label: "Power hitters (SR 150+)", target: 3, test: (p) => (p.bat_sr ?? 0) >= 150 && (p.runs ?? 0) >= 1000, rank: (a, b) => (b.bat_sr ?? 0) - (a.bat_sr ?? 0) },
];

// ---- smart pool search ------------------------------------------------------
// Plain words → filters: "left arm spinners", "keeper A under 32", "death econ<7",
// "lefty bat sr 150+", "affordable B pacers". Whatever isn't understood is
// matched against the name, so typing a name still works.
type QF = { label: string; test: (p: Enriched) => boolean };
const QUERY_RULES: [RegExp, QF][] = [
  [/\b(left[- ]?arm|sla|lefty?)\s*(orthodox\s*)?(spin(ners?)?|spinner|slow|orthodox|chinaman)\b/, { label: "Left-arm spin", test: (p) => p.tag === "Left-arm spin" }],
  [/\b(left[- ]?arm|lefty?)\s*(pace|pacers?|seam(ers?)?|fast|quicks?|medium)\b/, { label: "Left-arm pace", test: (p) => p.tag === "Left-arm pace" }],
  [/\b(right[- ]?arm)\s*(pace|pacers?|seam(ers?)?|fast|quicks?|medium)\b/, { label: "Right-arm pace", test: (p) => p.tag === "Right-arm pace" }],
  [/\b(off[- ]?spin(ners?)?|off[- ]?break|finger spin(ners?)?)\b/, { label: "Off-spin", test: (p) => p.tag === "Off-spin" }],
  [/\b(leg[- ]?spin(ners?)?|leggies?|wrist[- ]?spin(ners?)?|googly)\b/, { label: "Leg-spin", test: (p) => p.tag === "Leg-spin" }],
  [/\b(left[- ]?hand(ed)?|lhb|lefty|left)\s*(bat(ters?|sman|smen|s)?|hitters?|openers?)\b|\blhb\b/, { label: "Left-hand bat", test: (p) => p.lhb }],
  [/\bleft[- ]?arm(ers?)?(\s*bowlers?)?\b/, { label: "Left-arm bowler", test: (p) => p.tag === "Left-arm pace" || p.tag === "Left-arm spin" }],
  [/\b(pacers?|pace|seamers?|seam|fast bowlers?|quicks?|fast)\b/, { label: "Pace", test: (p) => isPace(p.tag) }],
  [/\b(spinners?|spin)\b/, { label: "Spin", test: (p) => isSpin(p.tag) }],
  [/\b(wicket[- ]?keepers?|keepers?|wk|wks|keeping)\b/, { label: "Keeper", test: (p) => !!p.is_keeper || /keep/i.test(p.primary_role ?? "") }],
  [/\b(death( overs?| bowlers?)?|finisher bowlers?|end overs)\b/, { label: "Death", test: (p) => p.starDeath || p.deathSpec }],
  [/\b(power ?play|pp|new[- ]ball|opening bowlers?)\b/, { label: "Powerplay", test: (p) => p.starPP || p.ppSpec }],
  [/\b(power[- ]?hitters?|big hitters?|hitters?|finishers?|six hitters?)\b/, { label: "Power hitter", test: (p) => (p.bat_sr ?? 0) >= 150 && (p.runs ?? 0) >= 1000 }],
  [/\b(all[- ]?rounders?|ar)\b/, { label: "All-rounder", test: (p) => /all/i.test(p.primary_role ?? "") }],
  [/\b(bat(ters?|sman|smen)|batting)\b/, { label: "Batter", test: (p) => /bat/i.test(p.primary_role ?? "") || (p.runs ?? 0) >= 2000 }],
  [/\b(bowlers?|bowling)\b/, { label: "Bowler", test: (p) => !!p.tag }],
  [/\b(clips?|videos?|footage)\b/, { label: "Has clips", test: (p) => !!p.clips }],
  [/\b(age[- ]?band|31[- ]?34)\b/, { label: "Age 31–34", test: (p) => inAgeBand(p.age) }],
  [/\b(legends?|special)\b/, { label: "Legend", test: (p) => p.cat === "Special" }],
  [/(^|\s)(a\+|a plus|aplus)(?=\s|$)/, { label: "A+", test: (p) => p.cat === "A+" }],
  [/\b(cat(egory)?\s*a|a cat(egory)?)\b|(^|\s)a(?=\s|$)/, { label: "A", test: (p) => p.cat === "A" }],
  [/\b(cat(egory)?\s*b|b cat(egory)?)\b|(^|\s)b(?=\s|$)/, { label: "B", test: (p) => p.cat === "B" }],
];
const STOP = /\b(show|me|all|the|any|players?|options?|remaining|available|left over|who|with|and|or|good|best|top|list|of|in|for|guys?|need|want|find|get|some|bowl(ers|ing)?|s)\b/g;
const NUM_RULES: [RegExp, (n: number, op: string) => QF][] = [
  [/\b(?:under|below|less than|<|u)\s*(\d{2})\b(?!\s*(sr|strike|avg|econ))|\bage\s*(<|under|below)\s*(\d{2})\b/, (n) => ({ label: `age < ${n}`, test: (p) => p.age != null && p.age < n })],
  [/\b(?:over|above|older than)\s*(\d{2})\b|\bage\s*(>|over|above)\s*(\d{2})\b/, (n) => ({ label: `age > ${n}`, test: (p) => p.age != null && p.age > n })],
  [/\b(?:econ(?:omy)?|eco|er)\s*(?:<|under|below|less than|upto|up to)?\s*(\d+(?:\.\d+)?)\b/, (n) => ({ label: `econ ≤ ${n}`, test: (p) => p.economy != null && p.economy <= n })],
  [/\b(?:sr|strike ?rate)\s*(?:>|over|above|more than)?\s*(\d{2,3})\+?|(\d{2,3})\+?\s*(?:sr|strike ?rate)\b/, (n) => ({ label: `SR ≥ ${n}`, test: (p) => (p.bat_sr ?? 0) >= n })],
  [/\b(?:avg|average)\s*(?:>|over|above|more than)?\s*(\d{1,3})\+?|(\d{1,3})\+?\s*(?:avg|average)\b/, (n) => ({ label: `avg ≥ ${n}`, test: (p) => (p.bat_avg ?? 0) >= n })],
  [/\b(?:index|idx)\s*(?:>|over|above)?\s*(\d{1,3})\b/, (n) => ({ label: `index ≥ ${n}`, test: (p) => (p.overall_index ?? 0) >= n })],
  [/\b(?:wkts?|wickets?)\s*(?:>|over|above)?\s*(\d{1,4})\+?|(\d{1,4})\+?\s*(?:wkts?|wickets?)\b/, (n) => ({ label: `wkts ≥ ${n}`, test: (p) => (p.wickets ?? 0) >= n })],
];
export function parsePoolQuery(raw: string): { filters: QF[]; name: string; afford: boolean; wish: boolean } {
  let t = ` ${raw.toLowerCase().replace(/[’'`]/g, "").replace(/\s+/g, " ")} `;
  const filters: QF[] = [];
  let afford = false, wish = false;
  if (/\b(affordable|can afford|within budget|in budget|cheap)\b/.test(t)) { afford = true; t = t.replace(/\b(affordable|can afford|within budget|in budget|cheap)\b/g, " "); }
  if (/\b(wish ?list|shortlist(ed)?|starred)\b/.test(t)) { wish = true; t = t.replace(/\b(wish ?list|shortlist(ed)?|starred)\b/g, " "); }
  for (const [re, make] of NUM_RULES) {
    const m = t.match(re);
    if (!m) continue;
    const n = Number(m.slice(1).find((x) => x && /^\d/.test(x)));
    if (Number.isFinite(n)) { filters.push(make(n, "")); t = t.replace(m[0], " "); }
  }
  for (const [re, f] of QUERY_RULES) {
    const m = t.match(re);
    if (!m) continue;
    // "left arm spin" must not also count as "spin" / "left-arm bowler"
    if (!filters.some((x) => x.label === f.label)) filters.push(f);
    t = t.replace(m[0], " ");
  }
  const name = t.replace(STOP, " ").replace(/[^a-z .]/g, " ").replace(/\s+/g, " ").trim();
  return { filters, name, afford, wish };
}
const SEARCH_EXAMPLES = ["left arm spinners", "death bowlers econ 7", "keeper under 32", "lefty bat sr 150", "affordable B pacers", "A+ all rounders"];

const R = DEFAULT_RULES;

export default function WarRoom(props: {
  league: League;
  leagueName: string;
  seasonId: string;
  myTeamId: string;
  canSwitch: boolean;
  canRecord?: boolean;
  profileId: string;
  teams: WRTeam[];
  players: WRPlayer[];
  initialLot: Lot;
}) {
  const [players, setPlayers] = useState(props.players);
  // purses change mid-auction (top-ups), so teams are live state too
  const [teams, setTeams] = useState(props.teams);
  const teamIds = useMemo(() => props.teams.map((t) => t.id), [props.teams]);
  const [lot, setLot] = useState<Lot>(props.initialLot);
  const [myTeamId, setMyTeamId] = useState(props.myTeamId);
  const [synced, setSynced] = useState<number | null>(null);

  // Live: realtime for speed, a 5 s poll as the safety net for venue wifi.
  useEffect(() => {
    const sb = createClient();
    let alive = true;
    const pull = async () => {
      const ids = teamIds;
      const [sold, lotRow, purses] = await Promise.all([
        sb.from("scout_players").select("id, team_id, sold_price, acquired, rtm_against").not("team_id", "is", null),
        sb.from("auction_lot").select("player_id, status, current_bid, base_price, leading_team_id").eq("season_id", props.seasonId).maybeSingle(),
        sb.from("teams").select("id, purse_total, purse_max").in("id", ids),
      ]);
      if (!alive) return;
      if (purses.data) {
        const pm = new Map((purses.data as unknown as { id: string; purse_total: number; purse_max: number | null }[]).map((r) => [r.id, r]));
        setTeams((ts) => ts.map((t) => {
          const r = pm.get(t.id);
          return r && (Number(r.purse_total) !== t.purse_total || r.purse_max !== t.purse_max) ? { ...t, purse_total: Number(r.purse_total), purse_max: r.purse_max } : t;
        }));
      }
      if (sold.data) {
        const m = new Map((sold.data as unknown as { id: string; team_id: string; sold_price: number; acquired: string; rtm_against: string | null }[]).map((r) => [r.id, r]));
        setPlayers((ps) =>
          ps.map((p) => {
            const s = m.get(p.id);
            const next = { team_id: s?.team_id ?? null, sold_price: s?.sold_price ?? null, acquired: s?.acquired ?? null, rtm_against: s?.rtm_against ?? null };
            return p.team_id === next.team_id && p.sold_price === next.sold_price && p.acquired === next.acquired && p.rtm_against === next.rtm_against ? p : { ...p, ...next };
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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "teams" }, () => pull())
      .subscribe();
    return () => {
      alive = false;
      clearInterval(id);
      sb.removeChannel(ch);
    };
  }, [props.seasonId, teamIds]);

  const all = useMemo(() => players.map(enrich), [players]);
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  const available = useMemo(() => all.filter((p) => !p.team_id), [all]);

  // Every team's purse and category counts — powers "who can still bid".
  const teamState = useMemo(() => {
    const m = new Map<string, { spent: number; size: number; band: number; cats: Record<AuctionCategory, number> }>();
    for (const t of teams) m.set(t.id, { spent: 0, size: 0, band: 0, cats: { "A+": 0, A: 0, B: 0, Special: 0 } });
    for (const p of all) {
      const s = p.team_id ? m.get(p.team_id) : null;
      if (!s) continue;
      s.spent += p.sold_price ?? 0;
      s.size += 1;
      if (inAgeBand(p.age)) s.band += 1;
      s.cats[p.cat] += 1;
    }
    return m;
  }, [all, teams]);

  const myTeam = teams.find((t) => t.id === myTeamId)!;
  const mine = all.filter((p) => p.team_id === myTeamId);
  const me = teamState.get(myTeamId)!;
  const purseLeft = myTeam.purse_total - me.spent;
  const stillNeed = Math.max(0, R.squadMin - me.size);

  // Can this squad still buy a player of this category (and age)? USCL rulebook:
  // only squad size (max 20) and the 31–34 age band (max 3) limit buying — the
  // category mixes apply to the match-day XII.
  function catRoom(state: { cats: Record<AuctionCategory, number>; size: number; band?: number }, cat: AuctionCategory, age?: number | null): boolean {
    if (state.size >= R.squadMax) return false;
    if (props.league === "uscl") return !(inAgeBand(age) && (state.band ?? 0) >= USCL_AGE_BAND.buyMax);
    return state.cats[cat] < R.cap[cat];
  }
  // Highest we can pay for one player and still fill the minimum squad at B base.
  const maxSafe = Math.max(0, purseLeft - Math.max(0, stillNeed - 1) * R.base.B);
  const affordable = (p: Enriched) => R.base[p.cat] <= maxSafe && catRoom(me, p.cat, p.age);
  // Top-ups not yet taken (rulebook: ₹50K + ₹25K, recorded by the admin).
  const topUpsLeft = Math.max(0, (myTeam.purse_max ?? myTeam.purse_total) - myTeam.purse_total);

  const needs = NEEDS.map((n) => {
    const have = mine.filter(n.test).length;
    const fit = available.filter(n.test);
    const canBuy = fit.filter(affordable);
    const picks = have >= n.target ? [] : canBuy.slice().sort(n.rank).slice(0, 5);
    return { ...n, have, picks, left: fit.length, canBuy: canBuy.length };
  });

  // ---- auction pad: one person calls up the player and records the sale ----
  const [viewId, setViewId] = useState<string | null>(null); // profile sheet

  // ---- wishlist: this login's own marks (player_marks, RLS = own rows only) ----
  const [wish, setWish] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    createClient()
      .from("player_marks")
      .select("player_id")
      .then(({ data }) => {
        if (alive && data) setWish(new Set((data as { player_id: string }[]).map((r) => r.player_id)));
      });
    return () => {
      alive = false;
    };
  }, []);
  function toggleWish(id: string) {
    const on = !wish.has(id);
    setWish((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
    const sb = createClient() as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
    const q = on
      ? sb.from("player_marks").insert({ marker_profile_id: props.profileId, player_id: id })
      : sb.from("player_marks").delete().eq("marker_profile_id", props.profileId).eq("player_id", id);
    q.then(({ error }: { error: unknown }) => {
      if (error)
        setWish((s) => {
          const n = new Set(s);
          if (on) n.delete(id);
          else n.add(id);
          return n;
        });
    });
  }
  const star = (id: string, className = "") => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); toggleWish(id); }}
      aria-label={wish.has(id) ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={wish.has(id)}
      className={`shrink-0 text-xl leading-none transition ${wish.has(id) ? "text-gold" : "text-line2 hover:text-gold"} ${className}`}
    >
      {wish.has(id) ? "★" : "☆"}
    </button>
  );
  const [padId, setPadId] = useState<string | null>(null);
  const [padQ, setPadQ] = useState("");
  const [padTeam, setPadTeam] = useState(props.myTeamId);
  const [padPrice, setPadPrice] = useState(0);
  // USCL owners can declare owner picks / retentions on the day, at fixed prices.
  const [padKind, setPadKind] = useState<"auction" | "owner" | "retained">("auction");
  const [padMsg, setPadMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [lastSale, setLastSale] = useState<{ id: string; name: string; teamId: string; price: number; kind: "auction" | "owner" | "retained" } | null>(null);
  const [saving, startSave] = useTransition();
  const padMatches = useMemo(() => {
    const words = padQ.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return available.filter((p) => words.every((w) => p.full_name.toLowerCase().includes(w))).sort(byIdx("overall_index")).slice(0, 6);
  }, [padQ, available]);
  const teamName = (id: string | null | undefined) => teams.find((t) => t.id === id)?.name ?? "—";
  const patch = (id: string, v: Partial<WRPlayer>) => setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, ...v } : p)));

  // Mirror the pad onto the live board's "on the block" (auctioneer logins only;
  // for anyone else these quietly fail and the pad works on its own).
  const boardShow = (id: string) => void withdrawLot().then(() => putUpLot(id)).catch(() => {});
  const boardClear = () => void withdrawLot().catch(() => {});

  function callUp(p: Enriched) {
    boardShow(p.id);
    setPadId(p.id);
    setPadQ("");
    setPadTeam(myTeamId);
    setPadPrice(R.base[p.cat]);
    setPadKind("auction");
    setPadMsg(null);
  }
  function sell() {
    const p = padId ? byId.get(padId) : null;
    if (!p) return;
    const price = padPrice, teamId = padTeam, kind = padKind;
    const prev = { team_id: p.team_id, sold_price: p.sold_price, acquired: p.acquired };
    patch(p.id, { team_id: teamId, sold_price: price, acquired: kind });
    setPadId(null);
    boardClear();
    startSave(async () => {
      const r = await assignPlayer(p.id, teamId, price, kind);
      if (r?.error) {
        patch(p.id, prev);
        setPadId(p.id);
        setPadMsg({ text: r.error, bad: true });
      } else {
        setLastSale({ id: p.id, name: p.full_name, teamId, price, kind });
        setPadMsg({ text: `${p.full_name} → ${teamName(teamId)} · ${inr(price)}${kind === "auction" ? "" : kind === "owner" ? " · owner pick" : " · retained"}` });
      }
    });
  }
  // Purse top-up (rulebook: optional ₹50,000 and ₹25,000 during the auction).
  const [topTeam, setTopTeam] = useState(props.myTeamId);
  function topUp(teamId: string, amount: number) {
    const t = teams.find((x) => x.id === teamId);
    if (!t) return;
    const total = Math.min(t.purse_max ?? t.purse_total, t.purse_total + amount);
    setTeams((ts) => ts.map((x) => (x.id === teamId ? { ...x, purse_total: total } : x)));
    startSave(async () => {
      const r = await setPurse(teamId, total);
      if (r?.error) {
        setTeams((ts) => ts.map((x) => (x.id === teamId ? { ...x, purse_total: t.purse_total } : x)));
        setPadMsg({ text: r.error, bad: true });
      } else setPadMsg({ text: `${t.name} topped up ${inr(amount)} → purse ${inr(total)}` });
    });
  }

  function undoLast() {
    const s = lastSale;
    if (!s) return;
    patch(s.id, { team_id: null, sold_price: null, acquired: null, rtm_against: null });
    startSave(async () => {
      const r = await unassignPlayer(s.id);
      if (r?.error) setPadMsg({ text: r.error, bad: true });
      else {
        setLastSale(null);
        setPadId(s.id);
        setPadMsg({ text: `Undone — ${s.name} is back on the block` });
      }
    });
  }
  // USCL RTM (Owners & Retention Rules, RTM 2.1–2.2): a franchise calls its RTM →
  // the winning team may raise its bid once → the RTM team matches that revised
  // bid (player moves to them) or declines (player stays with the winner at the
  // revised bid). Only a match counts against the one RTM / the two-per-team cap.
  const [rtmCall, setRtmCall] = useState<{ fid: string; price: number } | null>(null);
  function rtmMatched() {
    const s = lastSale, c = rtmCall;
    if (!s || !c) return;
    startSave(async () => {
      const r = await rtmPlayer(s.id, c.fid, c.price);
      if (r?.error) setPadMsg({ text: r.error, bad: true });
      else {
        patch(s.id, { team_id: c.fid, sold_price: c.price, acquired: "rtm", rtm_against: s.teamId });
        setLastSale(null);
        setRtmCall(null);
        setPadMsg({ text: `RTM matched: ${s.name} → ${teamName(c.fid)} · ${inr(c.price)}` });
      }
    });
  }
  function rtmDeclined() {
    const s = lastSale, c = rtmCall;
    if (!s || !c) return;
    startSave(async () => {
      const r = c.price === s.price ? null : await assignPlayer(s.id, s.teamId, c.price, "auction");
      if (r?.error) setPadMsg({ text: r.error, bad: true });
      else {
        patch(s.id, { sold_price: c.price });
        setLastSale({ ...s, price: c.price });
        setRtmCall(null);
        setPadMsg({ text: `RTM declined by ${teamName(c.fid)}: ${s.name} stays with ${teamName(s.teamId)} · ${inr(c.price)}` });
      }
    });
  }

  const onBlock = (padId ? byId.get(padId) ?? null : null) ?? (lot.player_id ? byId.get(lot.player_id) ?? null : null);
  // The big number: the pad's running price while Nikhil works the pad; else the
  // live lot, but only if the lot is this same player (it can be stale).
  const lotIsThis = !!onBlock && lot.player_id === onBlock.id;
  const padLive = !!onBlock && padId === onBlock.id;
  const bidIsBase = padLive ? padPrice <= R.base[onBlock!.cat] : !(lotIsThis && lot.current_bid != null);
  const bid = !onBlock ? 0 : padLive ? padPrice || R.base[onBlock.cat] : lotIsThis ? lot.current_bid ?? lot.base_price ?? R.base[onBlock.cat] : R.base[onBlock.cat];
  const nextBid = padLive || bidIsBase ? bid : bid + bidStep(onBlock?.cat);
  const rivals = onBlock
    ? teams
        .filter((t) => t.id !== myTeamId)
        .map((t) => ({ t, s: teamState.get(t.id)! }))
        .filter(({ t, s }) => t.purse_total - s.spent >= nextBid && catRoom(s, onBlock.cat, onBlock.age))
        .sort((a, b) => b.t.purse_total - b.s.spent - (a.t.purse_total - a.s.spent))
    : [];
  const alternatives = onBlock
    ? available
        .filter((p) => p.id !== onBlock.id && (onBlock.tag ? p.tag === onBlock.tag : p.primary_role === onBlock.primary_role) && affordable(p))
        .sort(byIdx("overall_index"))
        .slice(0, 3)
    : [];
  // USCL Right to Match: who can still take a player off us after the hammer.
  const rtm = useMemo(() => rtmState(teams, all), [teams, all]);
  const rtmAgainstUs = rtm.against.get(myTeamId) ?? 0;
  const iHoldRtm = rtm.holders.has(myTeamId) && !rtm.holders.get(myTeamId);
  const threats = rtmThreats(rtm, myTeamId)
    .map((id) => ({ t: teams.find((t) => t.id === id)!, left: (teams.find((t) => t.id === id)?.purse_total ?? 0) - (teamState.get(id)?.spent ?? 0) }))
    .sort((a, b) => b.left - a.left);
  const lostToRtm = all.filter((p) => p.rtm_against === myTeamId && p.acquired === "rtm");
  const fills = onBlock ? needs.filter((n) => n.have < n.target && n.test(onBlock)).map((n) => n.label) : [];

  // ---- pool browser state ----
  const [q, setQ] = useState("");
  const [tagF, setTagF] = useState<string>("");
  const [catF, setCatF] = useState<string>("");
  const [onlyAvail, setOnlyAvail] = useState(true);
  const [limit, setLimit] = useState(40);
  const parsed = useMemo(() => parsePoolQuery(q), [q]);
  function askPool(text: string) {
    setQ(text);
    setTagF("");
    setCatF("");
    setOnlyAvail(true);
    setLimit(40);
    document.getElementById("pool")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const shown = useMemo(() => {
    const t = parsed.name;
    return all
      .filter((p) => (!onlyAvail || !p.team_id) && (!catF || p.cat === catF) && (!t || p.full_name.toLowerCase().includes(t)))
      .filter((p) => parsed.filters.every((f) => f.test(p)) && (!parsed.afford || affordable(p)) && (!parsed.wish || wish.has(p.id)))
      .filter((p) =>
        !tagF ? true
        : tagF === "death" ? p.starDeath || p.deathSpec
        : tagF === "pp" ? p.starPP || p.ppSpec
        : tagF === "wk" ? !!p.is_keeper
        : tagF === "clips" ? !!p.clips
        : tagF === "wish" ? wish.has(p.id)
        : p.tag === tagF
      )
      .sort(byIdx("overall_index"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- affordable follows purse/squad, both in `all`
  }, [all, parsed, tagF, catF, onlyAvail, wish, maxSafe]);

  // USCL: these are the match-day XII limits (1 A+·5 A·6 B or 2 A+·3 A·7 B, +1 Legend);
  // the B count is the one that bites — you can't field a side without enough B.
  const catRow: [AuctionCategory, string][] =
    props.league === "uscl"
      ? [["A+", "plays ≤2"], ["A", `plays ≤${me.cats["A+"] >= 2 ? 3 : 5}`], ["B", `need ${me.cats["A+"] >= 2 ? 7 : 6}+`], ["Special", "plays 1"]]
      : [["A+", `max ${R.cap["A+"]}`], ["A", `max ${R.cap.A}`], ["B", `max ${R.cap.B}`], ["Special", `max ${R.cap.Special}`]];

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-3 py-5 sm:px-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">
            War room · <span className="sm:hidden">{props.league === "uscl" ? "USCL Season 2" : "SDLL Season 2"}</span>
            <span className="hidden sm:inline">{props.leagueName}</span>
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-3xl sm:text-4xl">
            {myTeam.logo_url && <TeamCrest name={myTeam.name} logoUrl={myTeam.logo_url} size={52} />}
            {myTeam.name}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          {props.canSwitch && (
            <select className="input !w-auto !py-1.5 text-sm" value={myTeamId} onChange={(e) => setMyTeamId(e.target.value)} aria-label="Team">
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-up" /> live{synced ? ` · ${new Date(synced).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
          </span>
        </div>
      </div>

      {props.canRecord && (
        <section className="mt-4 rounded-[16px] border-2 border-red/40 bg-surface p-3 shadow-[var(--elev-sm)] sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="eyebrow">Auction pad</p>
            {saving && <span className="text-xs text-muted">saving…</span>}
          </div>
          {!padId ? (
            <div className="relative mt-2">
              <input
                className="input !py-3 text-base"
                placeholder="Who's up? Type 2–3 letters of the name"
                value={padQ}
                onChange={(e) => setPadQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && padMatches[0]) callUp(padMatches[0]); }}
                autoComplete="off"
                enterKeyHint="go"
              />
              {padMatches.length > 0 && (
                <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-[12px] border border-line bg-surface shadow-lg">
                  {padMatches.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => callUp(p)} className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-wash">
                        <span className="font-medium">{p.full_name}{p.starDeath ? " ★D" : ""}{p.starPP ? " ★P" : ""}</span>
                        <span className="tabular-nums shrink-0 text-xs text-muted">{catLabel(p.cat)} · {p.primary_role ?? ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-lg font-semibold">{byId.get(padId)?.full_name}</p>
                <button type="button" className="shrink-0 text-sm text-muted underline" onClick={() => { setPadId(null); boardClear(); }}>Unsold / clear</button>
              </div>
              {props.league === "uscl" && (
                <div className="flex gap-1.5">
                  {(["auction", "owner", "retained"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="pill h-11 flex-1 justify-center !px-2 !py-0 text-[0.8rem]"
                      data-active={padKind === k}
                      onClick={() => {
                        setPadKind(k);
                        const c = byId.get(padId)!.cat;
                        setPadPrice(k === "retained" ? USCL_RETAIN[c] : k === "owner" ? USCL_OWNER[c] : R.base[c]);
                      }}
                    >
                      {k === "auction" ? "Auction sale" : k === "owner" ? "Owner pick" : "Retained"}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" className="pill h-11 min-w-0 justify-center !px-3 !py-0 text-[0.8rem]" data-active={padTeam === myTeamId} onClick={() => setPadTeam(myTeamId)}>
                  <span className="truncate">Us · {teamName(myTeamId)}</span>
                </button>
                <div className="relative min-w-0">
                  <select
                    className="pill h-11 w-full min-w-0 appearance-none !py-0 !pl-4 !pr-9 text-[0.8rem] [&>option]:bg-white [&>option]:text-black"
                    data-active={padTeam !== myTeamId}
                    value={padTeam === myTeamId ? "" : padTeam}
                    onChange={(e) => setPadTeam(e.target.value || myTeamId)}
                    aria-label="Other team"
                  >
                    <option value="">Other team…</option>
                    {teams.filter((t) => t.id !== myTeamId).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <span className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs ${padTeam !== myTeamId ? "text-white" : "text-muted"}`}>▾</span>
                </div>
              </div>
              <div className="grid grid-cols-[minmax(7rem,1.4fr)_repeat(4,minmax(0,1fr))] gap-1.5">
                <input
                  type="number"
                  inputMode="numeric"
                  className="input h-11 !py-0 text-center font-semibold tabular-nums"
                  value={padPrice || ""}
                  onChange={(e) => setPadPrice(Number(e.target.value) || 0)}
                  aria-label="Price"
                />
                {(() => { const s = bidStep(byId.get(padId)?.cat); return [-s, s, 2 * s, 5 * s]; })().map((d) => (
                  <button key={d} type="button" className="pill h-11 justify-center !px-1 !py-0 text-[0.8rem] tabular-nums" onClick={() => setPadPrice((v) => Math.max(0, v + d))}>
                    {d > 0 ? "+" : "−"}{Math.abs(d) / 1000}K
                  </button>
                ))}
              </div>
              <button type="button" disabled={saving || !padPrice} onClick={sell} className="btn-accent h-12 w-full justify-center !py-0 text-base disabled:opacity-60">
                {padKind === "auction" ? "Sold to" : padKind === "owner" ? "Owner pick for" : "Retained by"} {teamName(padTeam)} · {inr(padPrice)}
              </button>
            </div>
          )}
          {padMsg && <p className={`mt-2 text-sm ${padMsg.bad ? "text-red" : "text-up"}`}>{padMsg.text}</p>}
          {!padId && props.league === "uscl" && (() => {
            const t = teams.find((x) => x.id === topTeam) ?? myTeam;
            const left = Math.max(0, (t.purse_max ?? t.purse_total) - t.purse_total);
            return (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3 text-sm">
                <span className="text-muted">Top-up:</span>
                <select className="input !w-auto !py-1.5 text-sm" value={topTeam} onChange={(e) => setTopTeam(e.target.value)} aria-label="Top-up team">
                  {teams.map((x) => (
                    <option key={x.id} value={x.id}>{x.id === myTeamId ? `Us · ${x.name}` : x.name}</option>
                  ))}
                </select>
                {[50000, 25000].filter((a) => a <= left).map((a) => (
                  <button key={a} type="button" disabled={saving} className="pill !px-3 !py-1.5" onClick={() => topUp(t.id, a)}>
                    +{inr(a)}
                  </button>
                ))}
                <span className="text-xs text-muted">purse {inr(t.purse_total)}{left ? ` · ${inr(left)} top-up left` : " · all top-ups taken"}</span>
              </div>
            );
          })()}
          {lastSale && !padId && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
              <button type="button" disabled={saving} onClick={undoLast} className="pill !px-3 !py-1.5">↶ Undo last</button>
              {props.league === "uscl" &&
                lastSale.kind === "auction" &&
                !rtmCall &&
                rtmThreats(rtm, lastSale.teamId).map((fid) => (
                  <button key={fid} type="button" disabled={saving} onClick={() => setRtmCall({ fid, price: lastSale.price })} className="pill !px-3 !py-1.5" title="This franchise calls its Right to Match">
                    RTM called: {teamName(fid)}
                  </button>
                ))}
              {rtmCall && (
                <div className="mt-1 w-full rounded-[10px] border p-2.5" style={{ borderColor: "var(--gold-line)", background: "var(--gold-fill)" }}>
                  <p className="text-[0.8rem] text-muted">
                    <strong className="text-ink">{teamName(rtmCall.fid)}</strong> called RTM. {teamName(lastSale.teamId)} may raise its bid once — set the revised bid:
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="num text-lg font-semibold tabular-nums">{inr(rtmCall.price)}</span>
                    {(() => { const st = bidStep(byId.get(lastSale.id)?.cat); return [-st, st, 2 * st, 5 * st]; })().map((d) => (
                      <button key={d} type="button" disabled={saving || rtmCall.price + d < lastSale.price} className="pill !px-2.5 !py-1" onClick={() => setRtmCall({ ...rtmCall, price: rtmCall.price + d })}>
                        {d > 0 ? "+" : "−"}{inr(Math.abs(d))}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" disabled={saving} onClick={rtmMatched} className="btn-accent !px-3 !py-1.5 text-sm">Matched → {teamName(rtmCall.fid)}</button>
                    <button type="button" disabled={saving} onClick={rtmDeclined} className="pill !px-3 !py-1.5">Declined → stays {teamName(lastSale.teamId)}</button>
                    <button type="button" disabled={saving} onClick={() => setRtmCall(null)} className="pill !px-3 !py-1.5">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* tiles */}
      {/* money first (two big tiles), then squad + the four category slots in one compact row */}
      <section className="mt-4 grid gap-2 lg:grid-cols-[2fr_5fr]">
        <div className="grid grid-cols-2 gap-2">
          <Tile k="Purse left" v={inr(purseLeft)} sub={`of ${inr(myTeam.purse_total)}${topUpsLeft ? ` · +${inr(topUpsLeft)} top-ups available` : ""}`} strong />
          <Tile k="Max safe bid" v={inr(maxSafe)} sub={`keeps ${Math.max(0, stillNeed - 1)} slots at ${inr(R.base.B)}${topUpsLeft ? ` · ${inr(maxSafe + topUpsLeft)} with top-ups` : ""}`} strong />
        </div>
        <div className={`grid gap-2 ${props.league === "uscl" ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-5"}`}>
          <Tile k="Squad" v={`${me.size}`} sub={`${R.squadMin}–${R.squadMax}`} compact />
          {props.league === "uscl" && (
            <Tile k="Age 31–34" v={`${me.band}`} sub={`max ${USCL_AGE_BAND.buyMax}`} warn={me.band >= USCL_AGE_BAND.buyMax} compact />
          )}
          {catRow.map(([c, rule]) => (
            <Tile key={c} k={catLabel(c)} v={`${me.cats[c]}`} sub={rule} warn={props.league === "uscl" ? c === "B" && me.cats.B < (me.cats["A+"] >= 2 ? 7 : 6) && R.squadMax - me.size <= (me.cats["A+"] >= 2 ? 7 : 6) - me.cats.B : !catRoom(me, c) && c !== "B"} compact />
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* on the block */}
        <section className="rounded-[16px] border border-line bg-surface p-4 shadow-[var(--elev-sm)]">
          <p className="eyebrow">On the block</p>
          {!onBlock ? (
            <p className="mt-3 text-sm text-muted">Nobody yet. The next player appears here the moment they&apos;re put up.</p>
          ) : (
            <div className="mt-3">
              <div className="flex flex-wrap gap-x-4 gap-y-3">
                <PlayerPhoto src={onBlock.photo_url} name={onBlock.full_name} className="h-24 w-20 shrink-0 rounded-[10px] sm:h-28 sm:w-24" sizes="96px" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl leading-tight sm:text-3xl">{onBlock.full_name}</h2>
                  <Chips p={onBlock} />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => toggleWish(onBlock.id)} className={`pill !px-3 !py-1.5 text-[0.8rem] ${wish.has(onBlock.id) ? "!border-[var(--gold-line)] !text-gold" : ""}`}>
                      {wish.has(onBlock.id) ? "★ On your wishlist" : "☆ Add to wishlist"}
                    </button>
                    {onBlock.clips && (
                      <a href={onBlock.clips} target="_blank" rel="noopener noreferrer" className="pill !border-red !px-3 !py-1.5 text-[0.8rem] !text-red">
                        ▶ Clips, pitch map &amp; wagon wheel ↗
                      </a>
                    )}
                  </div>
                </div>
                {/* phones: its own full-width row under the name; wider: right column */}
                <div className="flex w-full items-end justify-between gap-3 rounded-[10px] bg-wash px-3.5 py-2.5 sm:block sm:w-auto sm:shrink-0 sm:bg-transparent sm:p-0 sm:text-right">
                  <div>
                    <p className="label-mono">{bidIsBase ? "Base" : "Current bid"}</p>
                    <p className="mt-1 font-display text-3xl leading-none text-red sm:text-4xl">{inr(bid)}</p>
                  </div>
                  <p className={`text-right text-sm font-medium leading-snug sm:mt-1.5 ${nextBid <= maxSafe ? "text-up" : "text-red"}`}>
                    {nextBid <= maxSafe ? `We can go to ${inr(maxSafe)}` : "Beyond our safe limit"}
                  </p>
                </div>
              </div>

              <StatGrid p={onBlock} />

              {fills.length > 0 && (
                <p className="mt-3 rounded-[10px] bg-[color-mix(in_srgb,var(--up)_10%,transparent)] px-3 py-2 text-sm text-up">
                  Fills our gap: <strong>{fills.join(" · ")}</strong>
                </p>
              )}
              {!catRoom(me, onBlock.cat, onBlock.age) && (
                <p className="mt-3 rounded-[10px] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] px-3 py-2 text-sm text-red-deep">
                  {props.league === "uscl"
                    ? me.size >= R.squadMax
                      ? `Our squad is full (${R.squadMax}).`
                      : `Age ${onBlock.age}: we already have ${USCL_AGE_BAND.buyMax} players aged 31–34 — the rulebook allows no more.`
                    : `We have no ${catLabel(onBlock.cat)} slot left for him.`}
                </p>
              )}

              {props.league === "uscl" && threats.length > 0 && (
                <div className="mt-3 rounded-[10px] border border-line px-3 py-2 text-sm">
                  <p>
                    <strong>RTM risk:</strong> if we win him, {threats.filter((x) => x.left >= bid).length} franchise{threats.filter((x) => x.left >= bid).length === 1 ? "" : "s"} can still take him by RTM.{" "}
                    We get one revised bid — a franchise can&apos;t match beyond its purse.
                  </p>
                  <p className="tabular-nums mt-1 text-[0.78rem] text-muted">
                    {threats.map((x) => `${x.t.name} ${inr(x.left)}`).join(" · ")}
                  </p>
                </div>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="label-mono">Can still bid ({rivals.length})</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {rivals.slice(0, 6).map(({ t, s }) => (
                      <li key={t.id} className="flex justify-between gap-2">
                        <span className="truncate">{t.name}</span>
                        <span className="tabular-nums text-muted">{inr(t.purse_total - s.spent)}</span>
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
                        <span className="tabular-nums shrink-0 text-muted">{catLabel(p.cat)} · {num(p.overall_index)}</span>
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
          <div className="flex items-baseline justify-between gap-2">
            <p className="eyebrow">What we need next</p>
            <p className="text-[0.7rem] text-faint">tap a row for every option</p>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {needs.map((n) => {
              const done = n.have >= n.target;
              return (
                <li key={n.key} className="py-2">
                  <button type="button" onClick={() => askPool(n.q)} className="group -mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-2 rounded-[10px] px-2 py-1 text-left transition hover:bg-wash">
                    <span className="min-w-0">
                      <span className="font-medium group-hover:text-red-deep">{n.label}</span>
                      <span className="ml-2 text-[0.75rem] tabular-nums text-muted">
                        {n.left} left{n.left ? ` · ${n.canBuy} we can afford` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="flex gap-0.5" aria-label={`${n.have} of ${n.target}`}>
                        {Array.from({ length: n.target }, (_, i) => (
                          <span key={i} className="h-2 w-2 rounded-full" style={{ background: i < n.have ? (done ? "var(--up)" : "var(--red)") : "var(--line2)" }} />
                        ))}
                      </span>
                      <span className={`tabular-nums text-sm ${done ? "text-up" : "text-red"}`}>{n.have}/{n.target}{done ? " ✓" : ""}</span>
                      <span className="text-muted group-hover:text-red-deep">›</span>
                    </span>
                  </button>
                  {n.picks.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {n.picks.map((p) => (
                        <button key={p.id} type="button" onClick={() => setViewId(p.id)} className="rounded-full border border-line bg-surface px-2.5 py-1 text-[0.78rem] transition hover:border-red" title="Open profile">
                          {wish.has(p.id) && <span className="text-gold">★ </span>}
                          <span className="text-ink">{p.full_name}</span> <span className="tabular-nums text-muted">{catLabel(p.cat)}{phaseHint(p, n.key)}</span>
                        </button>
                      ))}
                      {n.canBuy > n.picks.length && (
                        <button type="button" onClick={() => askPool(`affordable ${n.q}`)} className="rounded-full px-2.5 py-1 text-[0.78rem] text-red-deep hover:underline">
                          +{n.canBuy - n.picks.length} more →
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[0.7rem] text-faint">
            ★ phase stars: top 10 by economy in {PHASES.matches} SARDA S6 + USCL E1 matches (CricHeroes AI commentary). Suggestions are players still available that fit our category slots and our max safe bid.
          </p>
        </section>
      </div>

      {props.league === "uscl" && (
        <section className="mt-5 rounded-[16px] border border-line bg-surface p-4 shadow-[var(--elev-sm)]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="eyebrow">RTM watch</p>
            <p className={`tabular-nums text-sm ${rtmAgainstUs >= RTM_MAX_AGAINST ? "text-up" : "text-muted"}`}>
              RTMs against us {rtmAgainstUs}/{RTM_MAX_AGAINST}
              {rtmAgainstUs >= RTM_MAX_AGAINST ? " · our buys are now RTM-proof" : ""}
              {iHoldRtm ? " · we hold 1 RTM" : rtm.holders.has(myTeamId) ? " · our RTM is used" : " · we have no RTM"}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[...rtm.holders].map(([id, used]) => (
              <span key={id} className={`whitespace-nowrap rounded-full px-3 py-1 text-[0.8rem] font-medium ${used ? "bg-wash text-muted line-through" : "bg-gold-fill text-gold"}`} title={used ? `Used on ${used.full_name}` : "Still holds its RTM"}>
                {teams.find((t) => t.id === id)?.name}{used ? ` · ${used.full_name}` : " · RTM"}
              </span>
            ))}
          </div>
          {lostToRtm.length > 0 && (
            <p className="mt-2 text-sm text-red-deep">Lost to RTM: {lostToRtm.map((p) => `${p.full_name} (${teams.find((t) => t.id === p.team_id)?.name}, ${inr(p.sold_price)})`).join(" · ")}</p>
          )}
        </section>
      )}

      {/* wishlist */}
      <section className="mt-5 rounded-[16px] border border-line bg-surface p-4 shadow-[var(--elev-sm)]">
        <div className="flex items-baseline justify-between gap-2">
          <p className="eyebrow">Our wishlist · {wish.size}</p>
          <p className="text-xs text-muted">Only you see this list</p>
        </div>
        {wish.size === 0 ? (
          <p className="mt-2 text-sm text-muted">Tap ☆ next to any player (pool, profile or on the block) to shortlist him here.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {all
              .filter((p) => wish.has(p.id))
              .sort((a, b) => (a.team_id ? 1 : 0) - (b.team_id ? 1 : 0) || (b.overall_index ?? 0) - (a.overall_index ?? 0))
              .map((p) => (
                <li key={p.id} className={`flex items-center gap-2 rounded-[10px] border border-line p-2 ${p.team_id ? "opacity-55" : ""} ${p.id === onBlock?.id ? "border-red bg-[color-mix(in_srgb,var(--red)_7%,transparent)]" : ""}`}>
                  {star(p.id)}
                  <button type="button" onClick={() => setViewId(p.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-medium">{p.full_name}</p>
                    <p className="truncate text-[0.72rem] text-muted">
                      {p.team_id
                        ? `Gone · ${p.team_id === myTeamId ? "ours" : teamName(p.team_id)} ${inr(p.sold_price)}`
                        : [catLabel(p.cat), p.tag, p.id === onBlock?.id ? "ON THE BLOCK" : affordable(p) ? null : "over our limit"].filter(Boolean).join(" · ")}
                    </p>
                  </button>
                  <span className="shrink-0 font-display text-lg">{num(p.overall_index)}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* our squad */}
      <section className="mt-5 rounded-[16px] border border-line bg-surface p-4 shadow-[var(--elev-sm)]">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">Our squad · {mine.length}</p>
          <p className="tabular-nums text-sm text-muted">spent {inr(me.spent)}</p>
        </div>
        <p className="mt-1 text-xs text-muted">Tap a player for his full profile.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {mine
            .sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0))
            .map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setViewId(p.id)} className="flex w-full items-center gap-3 rounded-[10px] border border-line p-2 text-left transition hover:border-red/40 hover:bg-wash">
                <PlayerPhoto src={p.photo_url} name={p.full_name} className="h-10 w-10 shrink-0 rounded-full" sizes="40px" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.full_name}</p>
                  <p className="truncate text-[0.72rem] text-muted">{[catLabel(p.cat), p.tag, p.acquired === "owner" ? "Owner" : p.acquired === "retained" ? "Retained" : p.acquired === "rtm" ? "RTM" : null].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="tabular-nums text-sm">{inr(p.sold_price)}</span>
                </button>
              </li>
            ))}
        </ul>
      </section>

      {/* pool */}
      <section id="pool" className="scroll-mt-4 mt-5 rounded-[16px] border border-line bg-surface p-4 shadow-[var(--elev-sm)]">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow mr-2">Pool</p>
          <div className="relative w-full sm:w-[26rem]">
            <input
              className="input !py-2 !pr-8 text-sm"
              placeholder={'Ask: "left arm spinners", "keeper under 32"…'}
              value={q}
              onChange={(e) => { setQ(e.target.value); setLimit(40); }}
            />
            {q && (
              <button type="button" aria-label="Clear" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-muted hover:text-ink">✕</button>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} className="accent-[var(--red-deep)]" /> available only
          </label>
          <span className="tabular-nums ml-auto text-xs text-muted">{shown.length} players</span>
        </div>
        {q.trim() ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.78rem]">
            <span className="text-muted">Showing</span>
            {parsed.filters.map((f) => (
              <span key={f.label} className="rounded-full bg-[color-mix(in_srgb,var(--red)_10%,transparent)] px-2.5 py-0.5 font-medium text-red-deep">{f.label}</span>
            ))}
            {parsed.afford && <span className="rounded-full bg-[color-mix(in_srgb,var(--up)_12%,transparent)] px-2.5 py-0.5 font-medium text-up">we can afford</span>}
            {parsed.wish && <span className="rounded-full px-2.5 py-0.5 font-medium text-gold" style={{ background: "var(--gold-fill)" }}>★ wishlist</span>}
            {parsed.name && <span className="rounded-full bg-wash px-2.5 py-0.5">name “{parsed.name}”</span>}
            {!parsed.filters.length && !parsed.name && !parsed.afford && !parsed.wish && <span className="text-muted">everyone</span>}
            <span className="text-muted">{onlyAvail ? "· still available" : "· incl. sold"}</span>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.78rem]">
            <span className="text-muted">Try</span>
            {SEARCH_EXAMPLES.map((x) => (
              <button key={x} type="button" onClick={() => { setQ(x); setLimit(40); }} className="rounded-full border border-dashed border-line2 px-2.5 py-0.5 text-muted hover:border-red hover:text-red-deep">{x}</button>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[["", "All"], ["death", "★ Death"], ["pp", "★ Powerplay"], ...BOWL_TAGS.map((t) => [t, t]), ["wk", "Keepers"], ["clips", "▶ Has clips"], ["wish", `★ Wishlist (${wish.size})`]].map(([k, l]) => (
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
        {/* phones: one card per player — the full table is too wide to read */}
        <ul className="mt-3 divide-y divide-line sm:hidden">
          {shown.slice(0, limit).map((p) => (
            <li key={p.id} className={`flex items-center gap-2 ${p.id === lot.player_id ? "bg-[color-mix(in_srgb,var(--red)_7%,transparent)]" : ""} ${p.team_id ? "opacity-50" : ""}`}>
              {star(p.id, "px-1 py-2")}
              <button type="button" onClick={() => setViewId(p.id)} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {p.full_name}
                    {p.starDeath && <span className="ml-1 text-gold">★D</span>}
                    {p.starPP && <span className="ml-1 text-gold">★P</span>}
                  </p>
                  <p className="truncate text-[0.75rem] text-muted">
                    {[catLabel(p.cat), p.tag, p.is_keeper ? "WK" : null, p.team_id ? `${teams.find((t) => t.id === p.team_id)?.name} ${inr(p.sold_price)}` : null].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-0.5 text-[0.75rem] tabular-nums text-ink">
                    SR <b>{num(p.bat_sr)}</b> · Avg <b>{num(p.bat_avg)}</b> · Econ <b>{num(p.economy)}</b>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-xl leading-none">{num(p.overall_index)}</p>
                  <p className="label-mono mt-1">Index</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 hidden overflow-x-auto sm:block">
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
                    {star(p.id, "mr-1.5 align-middle !text-base")}
                    <button type="button" onClick={() => setViewId(p.id)} className="text-left font-medium underline-offset-4 hover:text-red hover:underline">{p.full_name}</button>
                    {p.starDeath && <span className="ml-1 text-gold" title="Top 10 death bowler">★D</span>}
                    {p.starPP && <span className="ml-1 text-gold" title="Top 10 powerplay bowler">★P</span>}
                    {p.team_id && <span className="ml-1 text-[0.7rem] text-muted">· {teams.find((t) => t.id === p.team_id)?.name} {inr(p.sold_price)}</span>}
                  </td>
                  <td className="px-2">{catLabel(p.cat)}</td>
                  <td className="px-2 text-muted">{p.tag ?? "—"}{p.is_keeper ? " · WK" : ""}</td>
                  <td className="tabular-nums px-2">{num(p.bat_matches)}</td>
                  <td className="tabular-nums px-2">{num(p.runs)}</td>
                  <td className="tabular-nums px-2">{num(p.bat_avg)}</td>
                  <td className="tabular-nums px-2">{num(p.bat_sr)}</td>
                  <td className="tabular-nums px-2">{num(p.wickets)}</td>
                  <td className="tabular-nums px-2">{num(p.economy)}</td>
                  <td className="tabular-nums px-2">{p.phase?.pp.balls ? `${p.phase.pp.econ} (${p.phase.pp.balls}b)` : "—"}</td>
                  <td className="tabular-nums px-2">{p.phase?.death.balls ? `${p.phase.death.econ} (${p.phase.death.balls}b)` : "—"}</td>
                  <td className="tabular-nums px-2 font-medium">{num(p.overall_index)}</td>
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
      {viewId && byId.get(viewId) && (
        <ProfileSheet
          p={byId.get(viewId)!}
          teamName={teamName(byId.get(viewId)!.team_id)}
          ours={byId.get(viewId)!.team_id === myTeamId}
          onClose={() => setViewId(null)}
          star={star(viewId)}
        />
      )}
    </main>
  );
}

// A player's full War Room profile without putting him on the block — for our
// own squad, and any name in the pool table.
function ProfileSheet({ p, teamName, ours, onClose, star }: { p: Enriched; teamName: string; ours: boolean; onClose: () => void; star: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const how = p.acquired === "owner" ? "Owner pick" : p.acquired === "retained" ? "Retained" : p.acquired === "rtm" ? "Won by RTM" : p.acquired === "auction" ? "Bought at auction" : null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={p.full_name}>
      <div className="max-h-[92vh] w-full max-w-[640px] overflow-y-auto rounded-t-[18px] bg-surface p-4 shadow-2xl sm:rounded-[18px] sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow">{ours ? "Our squad" : p.team_id ? teamName : "In the pool"}</p>
          <button type="button" onClick={onClose} className="-mr-1 -mt-1 rounded-full px-3 py-1 text-xl leading-none text-muted hover:bg-wash hover:text-ink" aria-label="Close">×</button>
        </div>
        <div className="mt-2 flex gap-4">
          <PlayerPhoto src={p.photo_url} name={p.full_name} className="h-24 w-20 shrink-0 rounded-[10px] sm:h-28 sm:w-24" sizes="96px" />
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-2xl leading-tight sm:text-3xl">{p.full_name} {star}</h2>
            <Chips p={p} />
            {p.team_id && (
              <p className="mt-2 text-sm text-muted">
                {[how, inr(p.sold_price)].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <StatGrid p={p} />
        {p.clips && (
          <a href={p.clips} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-red px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            ▶ Watch clips
          </a>
        )}
      </div>
    </div>
  );
}

const num = (v: number | null | undefined) => (v == null ? "—" : String(Math.round(v * 10) / 10));
const phaseHint = (p: Enriched, key: string) =>
  key === "death" && p.phase?.death.econ != null ? ` · ${p.phase.death.econ}` : key === "pp" && p.phase?.pp.econ != null ? ` · ${p.phase.pp.econ}` : "";

function Tile({ k, v, sub, strong, warn, compact }: { k: string; v: string; sub?: string; strong?: boolean; warn?: boolean; compact?: boolean }) {
  const frame = warn ? "border-red/50 bg-[color-mix(in_srgb,var(--red)_6%,transparent)]" : "border-line bg-surface";
  if (compact)
    return (
      <div className={`flex flex-col items-center justify-center rounded-[12px] border px-1 py-2.5 text-center ${frame}`}>
        <p className="label-mono !tracking-[0.08em]">{k}</p>
        <p className="mt-1 font-display text-2xl leading-none">{v}</p>
        {sub && <p className="mt-1.5 text-[0.65rem] leading-tight text-muted">{sub}</p>}
      </div>
    );
  return (
    <div className={`flex flex-col rounded-[12px] border px-3.5 py-3 sm:px-4 ${frame}`}>
      <p className="label-mono">{k}</p>
      <p className={`mt-2 font-display leading-none tabular-nums ${strong ? "text-[1.7rem] text-red sm:text-3xl" : "text-xl"}`}>{v}</p>
      {sub && <p className="mt-2 text-[0.72rem] leading-snug text-muted">{sub}</p>}
    </div>
  );
}

function Chips({ p }: { p: Enriched }) {
  const chips = [catLabel(p.cat), p.primary_role, p.tag, p.is_keeper && !/keep/i.test(p.primary_role ?? "") ? "Keeper" : null, p.lhb ? "Left-hand bat" : null].filter(Boolean);
  // brand sans, not the mono badge face, so the chips sit with the rest of the card
  const chip = "whitespace-nowrap rounded-full px-3 py-1 text-[0.8rem] font-medium";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {p.age && (
        <span className={`${chip} bg-[var(--red)] font-semibold text-white`}>Age {p.age}{inAgeBand(p.age) ? " · 31–34 band" : ""}</span>
      )}
      {chips.map((c) => (
        <span key={c as string} className={`${chip} bg-wash text-ink`}>{c}</span>
      ))}
      {p.starDeath && <span className={`${chip} bg-gold-fill text-gold`}>★ Top-10 death</span>}
      {p.starPP && <span className={`${chip} bg-gold-fill text-gold`}>★ Top-10 powerplay</span>}
    </div>
  );
}

// Good / middling / poor for a 30+ T20 league — the colour is the read at a glance.
type Tone = "good" | "ok" | "poor";
const toneCls: Record<Tone, string> = { good: "text-up", ok: "text-[#b7791f]", poor: "text-red" };
const hi = (v: number | null | undefined, good: number, ok: number): Tone | null => (v == null ? null : v >= good ? "good" : v >= ok ? "ok" : "poor");
const lo = (v: number | null | undefined, good: number, ok: number): Tone | null => (v == null ? null : v <= good ? "good" : v <= ok ? "ok" : "poor");

function StatGrid({ p }: { p: Enriched }) {
  const ph = p.phase;
  const cells: { k: string; v: string; tone?: Tone | null; key?: boolean }[] = [
    { k: "Mat", v: num(p.bat_matches) },
    { k: "Runs", v: num(p.runs) },
    { k: "Avg", v: num(p.bat_avg), tone: hi(p.bat_avg, 30, 20), key: true },
    { k: "SR", v: num(p.bat_sr), tone: hi(p.bat_sr, 150, 125), key: true },
    { k: "Wkts", v: num(p.wickets) },
    { k: "Econ", v: num(p.economy), tone: lo(p.economy, 7, 8.5), key: true },
  ];
  const phases = ph
    ? ([
        ["PP econ", ph.pp, 7.5, 9],
        ["Middle econ", ph.mid, 7, 8.5],
        ["Death econ", ph.death, 9, 11],
      ] as const)
        .filter(([, s]) => s.balls > 0)
        .map(([k, s, g, o]) => ({ k, v: String(s.econ ?? "—"), sub: `${s.wkts}w · ${s.balls}b`, tone: lo(s.econ, g, o) }))
    : [];
  return (
    <div className="mt-4 space-y-2">
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {cells.map((c) => (
          <div key={c.k} className={`rounded-[10px] px-2 py-1.5 text-center ${c.key ? "bg-wash" : ""}`}>
            <p className="label-mono">{c.k}</p>
            <p className={`font-display leading-tight tabular-nums ${c.key ? "text-2xl font-bold" : "text-xl"} ${c.tone ? toneCls[c.tone] : "text-ink"}`}>{c.v}</p>
          </div>
        ))}
      </div>
      {phases.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {phases.map((c) => (
            <div key={c.k} className="rounded-[10px] border border-line px-2 py-1.5 text-center">
              <p className="label-mono">{c.k}</p>
              <p className={`font-display text-xl font-bold leading-tight tabular-nums ${c.tone ? toneCls[c.tone] : "text-ink"}`}>{c.v}</p>
              <p className="text-[0.68rem] text-muted tabular-nums">{c.sub}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
