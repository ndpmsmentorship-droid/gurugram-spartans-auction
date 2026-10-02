"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { assignPlayer, unassignPlayer, rtmPlayer } from "@/app/admin/auction/actions";
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
  canRecord?: boolean;
  profileId: string;
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
        sb.from("scout_players").select("id, team_id, sold_price, acquired, rtm_against").not("team_id", "is", null),
        sb.from("auction_lot").select("player_id, status, current_bid, base_price, leading_team_id").eq("season_id", props.seasonId).maybeSingle(),
      ]);
      if (!alive) return;
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
    const m = new Map<string, { spent: number; size: number; band: number; cats: Record<AuctionCategory, number> }>();
    for (const t of props.teams) m.set(t.id, { spent: 0, size: 0, band: 0, cats: { "A+": 0, A: 0, B: 0, Special: 0 } });
    for (const p of all) {
      const s = p.team_id ? m.get(p.team_id) : null;
      if (!s) continue;
      s.spent += p.sold_price ?? 0;
      s.size += 1;
      if (inAgeBand(p.age)) s.band += 1;
      s.cats[p.cat] += 1;
    }
    return m;
  }, [all, props.teams]);

  const myTeam = props.teams.find((t) => t.id === myTeamId)!;
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
    const picks = have >= n.target ? [] : available.filter((p) => n.test(p) && affordable(p)).sort(n.rank).slice(0, 5);
    return { ...n, have, picks };
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
  const teamName = (id: string | null | undefined) => props.teams.find((t) => t.id === id)?.name ?? "—";
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
  function rtmLast(fid: string) {
    const s = lastSale;
    if (!s) return;
    startSave(async () => {
      const r = await rtmPlayer(s.id, fid, s.price);
      if (r?.error) setPadMsg({ text: r.error, bad: true });
      else {
        patch(s.id, { team_id: fid, acquired: "rtm", rtm_against: s.teamId });
        setLastSale(null);
        setPadMsg({ text: `RTM: ${s.name} → ${teamName(fid)} · ${inr(s.price)}` });
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
    ? props.teams
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
  const rtm = useMemo(() => rtmState(props.teams, all), [props.teams, all]);
  const rtmAgainstUs = rtm.against.get(myTeamId) ?? 0;
  const iHoldRtm = rtm.holders.has(myTeamId) && !rtm.holders.get(myTeamId);
  const threats = rtmThreats(rtm, myTeamId)
    .map((id) => ({ t: props.teams.find((t) => t.id === id)!, left: (props.teams.find((t) => t.id === id)?.purse_total ?? 0) - (teamState.get(id)?.spent ?? 0) }))
    .sort((a, b) => b.left - a.left);
  const lostToRtm = all.filter((p) => p.rtm_against === myTeamId && p.acquired === "rtm");
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
        : tagF === "wish" ? wish.has(p.id)
        : p.tag === tagF
      )
      .sort(byIdx("overall_index"));
  }, [all, q, tagF, catF, onlyAvail, wish]);

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
                      className="pill flex-1 !px-2 !py-2"
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
              <div className="flex gap-1.5">
                <button type="button" className="pill shrink-0 !px-4 !py-2.5" data-active={padTeam === myTeamId} onClick={() => setPadTeam(myTeamId)}>
                  Us
                </button>
                <select
                  className="input !py-2.5"
                  value={padTeam === myTeamId ? "" : padTeam}
                  onChange={(e) => setPadTeam(e.target.value || myTeamId)}
                  aria-label="Other team"
                >
                  <option value="">Other team…</option>
                  {props.teams.filter((t) => t.id !== myTeamId).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="number"
                  inputMode="numeric"
                  className="input !w-32 !py-2.5 font-semibold"
                  value={padPrice || ""}
                  onChange={(e) => setPadPrice(Number(e.target.value) || 0)}
                  aria-label="Price"
                />
                {(() => { const s = bidStep(byId.get(padId)?.cat); return [-s, s, 2 * s, 5 * s]; })().map((d) => (
                  <button key={d} type="button" className="pill !px-3 !py-2" onClick={() => setPadPrice((v) => Math.max(0, v + d))}>
                    {d > 0 ? "+" : "−"}{Math.abs(d) / 1000}K
                  </button>
                ))}
              </div>
              <button type="button" disabled={saving || !padPrice} onClick={sell} className="btn-accent w-full !py-3 text-base disabled:opacity-60">
                {padKind === "auction" ? "Sold to" : padKind === "owner" ? "Owner pick for" : "Retained by"} {teamName(padTeam)} · {inr(padPrice)}
              </button>
            </div>
          )}
          {padMsg && <p className={`mt-2 text-sm ${padMsg.bad ? "text-red" : "text-up"}`}>{padMsg.text}</p>}
          {lastSale && !padId && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
              <button type="button" disabled={saving} onClick={undoLast} className="pill !px-3 !py-1.5">↶ Undo last</button>
              {props.league === "uscl" &&
                lastSale.kind === "auction" &&
                rtmThreats(rtm, lastSale.teamId).map((fid) => (
                  <button key={fid} type="button" disabled={saving} onClick={() => rtmLast(fid)} className="pill !px-3 !py-1.5" title="This franchise used its RTM and matched">
                    RTM: {teamName(fid)} matched
                  </button>
                ))}
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
                  <button type="button" onClick={() => toggleWish(onBlock.id)} className={`mt-2 text-sm font-medium ${wish.has(onBlock.id) ? "text-gold" : "text-muted hover:text-gold"}`}>
                    {wish.has(onBlock.id) ? "★ On your wishlist" : "☆ Add to wishlist"}
                  </button>
                  {onBlock.clips && (
                    <a href={onBlock.clips} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-red underline underline-offset-4">
                      ▶ Watch clips
                    </a>
                  )}
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
          <p className="eyebrow">What we need next</p>
          <ul className="mt-3 divide-y divide-line">
            {needs.map((n) => (
              <li key={n.key} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{n.label}</span>
                  <span className={`tabular-nums text-sm ${n.have >= n.target ? "text-up" : "text-red"}`}>
                    {n.have}/{n.target} {n.have >= n.target ? "✓" : ""}
                  </span>
                </div>
                {n.picks.length > 0 && (
                  <p className="mt-1 text-[0.8rem] leading-relaxed text-muted">
                    {n.picks.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && " · "}
                        <span className="text-ink">{p.full_name}</span> <span className="tabular-nums">({catLabel(p.cat)}{phaseHint(p, n.key)})</span>
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
                {props.teams.find((t) => t.id === id)?.name}{used ? ` · ${used.full_name}` : " · RTM"}
              </span>
            ))}
          </div>
          {lostToRtm.length > 0 && (
            <p className="mt-2 text-sm text-red-deep">Lost to RTM: {lostToRtm.map((p) => `${p.full_name} (${props.teams.find((t) => t.id === p.team_id)?.name}, ${inr(p.sold_price)})`).join(" · ")}</p>
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
      <section className="mt-5 rounded-[16px] border border-line bg-surface p-4 shadow-[var(--elev-sm)]">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow mr-2">Pool</p>
          <input className="input !w-48 !py-1.5 text-sm" placeholder="Search name" value={q} onChange={(e) => { setQ(e.target.value); setLimit(40); }} />
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} className="accent-[var(--red-deep)]" /> available only
          </label>
          <span className="tabular-nums ml-auto text-xs text-muted">{shown.length} players</span>
        </div>
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
                    {[catLabel(p.cat), p.tag, p.is_keeper ? "WK" : null, p.team_id ? `${props.teams.find((t) => t.id === p.team_id)?.name} ${inr(p.sold_price)}` : null].filter(Boolean).join(" · ")}
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
                    {p.team_id && <span className="ml-1 text-[0.7rem] text-muted">· {props.teams.find((t) => t.id === p.team_id)?.name} {inr(p.sold_price)}</span>}
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
