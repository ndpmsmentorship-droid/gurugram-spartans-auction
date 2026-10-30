// The owner's planner: rates every player, scores a playing XII, prices the
// pool, builds the best squad a purse can still buy for a chosen strategy, and
// gives the live verdict on the player on the block.
//
// One yardstick everywhere: the XII score is the runs a match the playing
// twelve is worth — the top 7 batters' runs a match plus the top 5 bowlers'
// bowling value in runs (wickets ≈ 20 runs each, economy against a par of 9 an
// over across 4 overs). Ratings come from each player's Sarda/SCCL + Ball
// Library record; players with no record get their category's median and are
// flagged, so nobody is quietly scored as if we knew him.
//
// Pure functions only — the War Room and the Plan page call these in the browser.

export type PlanCat = "A+" | "A" | "B" | "Special";

export type PlanPlayer = {
  id: string;
  full_name: string;
  cat: PlanCat;
  primary_role: string | null;
  bowling_style: string | null;
  is_keeper: boolean | null;
  age: number | null;
  bat_matches: number | null;
  runs: number | null;
  bat_avg: number | null;
  bat_sr: number | null;
  wickets: number | null;
  economy: number | null;
  overall_index: number | null;
  team_id: string | null;
  sold_price: number | null;
};

export type DataLevel = "ok" | "thin" | "none";

export type Rated = PlanPlayer & {
  bat: number; // runs a match
  bowl: number; // bowling value, runs a match
  bowler: boolean;
  keeper: boolean;
  data: DataLevel;
  price: number; // estimated hammer price (sold price once sold)
};

export type PlanRules = { squadMin: number; squadMax: number; maxBid: number; base: Record<PlanCat, number>; cap: Record<PlanCat, number> };

const PAR_ECON = 9;
const THIN = 10; // fewer matches than this = little evidence

export const DATA_LABEL: Record<DataLevel, string> = { ok: "", thin: "Little data", none: "No data yet" };

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export function rateAll(players: PlanPlayer[], rules: PlanRules): Rated[] {
  const raw = players.map((p) => {
    const m = p.bat_matches ?? 0;
    const data: DataLevel = m <= 0 && p.overall_index == null ? "none" : m < THIN ? "thin" : "ok";
    const bat = m > 0 ? Math.min(45, (p.runs ?? 0) / m) : NaN;
    const wpm = m > 0 ? (p.wickets ?? 0) / m : NaN;
    const econ = p.economy ?? PAR_ECON;
    const bowl = m > 0 && (p.wickets ?? 0) > 0 ? Math.max(0, Math.min(40, wpm * 20 + (PAR_ECON - econ) * 4)) : m > 0 ? 0 : NaN;
    const role = (p.primary_role ?? "").toLowerCase();
    const bowler = /bowl|allround|all-round|all round/.test(role) || (Number.isFinite(wpm) && wpm >= 0.5);
    const keeper = !!p.is_keeper || /keep/.test(role);
    return { p, data, bat, bowl, bowler, keeper };
  });

  // Category medians stand in for players we have no record of.
  const med: Record<string, { bat: number; bowl: number }> = {};
  for (const c of ["A+", "A", "B", "Special"] as PlanCat[]) {
    const known = raw.filter((r) => r.p.cat === c && r.data === "ok");
    med[c] = { bat: median(known.map((r) => r.bat)), bowl: median(known.filter((r) => r.bowler).map((r) => r.bowl)) };
  }

  // Price: category base plus a premium by where he sits inside his category.
  const byCat = new Map<PlanCat, number[]>();
  for (const r of raw) {
    const v = r.p.overall_index ?? -1;
    byCat.set(r.p.cat, [...(byCat.get(r.p.cat) ?? []), v]);
  }
  for (const v of byCat.values()) v.sort((a, b) => a - b);
  const pct = (p: PlanPlayer) => {
    const v = byCat.get(p.cat) ?? [];
    if (v.length < 2 || p.overall_index == null) return 0.3;
    return v.filter((x) => x < (p.overall_index as number)).length / (v.length - 1);
  };

  return raw.map(({ p, data, bat, bowl, bowler, keeper }) => {
    const base = rules.base[p.cat];
    const est = Math.round((base * (1 + 4 * pct(p) ** 2)) / 1000) * 1000;
    return {
      ...p,
      data,
      bat: Number.isFinite(bat) ? bat : med[p.cat].bat,
      bowl: Number.isFinite(bowl) ? bowl : bowler ? med[p.cat].bowl : 0,
      bowler,
      keeper,
      price: p.team_id ? p.sold_price ?? base : Math.min(rules.maxBid, Math.max(base, est)),
    };
  });
}

// ---- the playing XII -----------------------------------------------------------
export type XII = { score: number; bat: number; bowl: number; twelve: Rated[]; keeper: boolean };

function scoreOf(xs: Rated[]): { score: number; bat: number; bowl: number; keeper: boolean } {
  const bat = xs.map((p) => p.bat).sort((a, b) => b - a).slice(0, 7).reduce((a, b) => a + b, 0);
  const bowl = xs.filter((p) => p.bowler).map((p) => p.bowl).sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
  const keeper = xs.some((p) => p.keeper);
  // A side without five bowlers or a keeper pays for it on match day.
  const short = Math.max(0, 5 - xs.filter((p) => p.bowler).length) * 6 + (keeper ? 0 : 10);
  return { score: Math.round(bat + bowl - short), bat: Math.round(bat), bowl: Math.round(bowl), keeper };
}

/** The best twelve out of a squad, picked greedily on the XII score. */
export function bestXII(squad: Rated[]): XII {
  const left = squad.slice();
  const twelve: Rated[] = [];
  while (twelve.length < 12 && left.length) {
    let bi = 0, bs = -Infinity;
    for (let i = 0; i < left.length; i++) {
      const s = scoreOf([...twelve, left[i]]).score + (left[i].bat + left[i].bowl) / 1000;
      if (s > bs) { bs = s; bi = i; }
    }
    twelve.push(left.splice(bi, 1)[0]);
  }
  // The score is the squad's (top 7 batters + top 5 bowlers — at most twelve
  // people), so it never disagrees with what the planner optimised; the
  // greedy twelve is only for drawing the field map.
  return { ...scoreOf(squad), twelve };
}

// ---- strategies -------------------------------------------------------------------
export type StrategyKey = "balanced" | "bowling" | "batting" | "turnsup" | "veterans";
export const STRATEGIES: { key: StrategyKey; name: string; blurb: string }[] = [
  { key: "balanced", name: "Balanced", blurb: "The strongest XII overall" },
  { key: "bowling", name: "Bowling attack", blurb: "Leans on wicket-takers" },
  { key: "batting", name: "Batting depth", blurb: "Runs all the way down" },
  { key: "turnsup", name: "Turns up", blurb: "Players who never miss a game" },
  { key: "veterans", name: "Safe veterans", blurb: "Proven over many seasons" },
];

/** How a strategy tilts one player's worth when choosing whom to buy. */
function tilt(key: StrategyKey, p: Rated): number {
  const m = p.bat_matches ?? 0;
  switch (key) {
    case "bowling": return p.bowler ? 1 + p.bowl / 40 : 0.6;
    case "batting": return 0.6 + p.bat / 40;
    case "turnsup": return 0.4 + Math.min(1, m / 200);
    case "veterans": return (m >= 150 ? 1.3 : 0.6) * ((p.age ?? 0) >= 40 ? 1.2 : 1);
    default: return 1;
  }
}

export type Plan = {
  key: StrategyKey;
  squad: Rated[]; // owned + planned buys
  buys: Rated[];
  cost: number; // spent on the planned buys (estimates)
  xii: XII;
};

export type PlanInput = {
  rated: Rated[];
  mine: Rated[]; // already bought
  purseLeft: number;
  rules: PlanRules;
  going: Set<string>; // "going for him" — must be in the plan
  rejected: Set<string>; // never planned
  forced?: { id: string; price: number }; // the live player at the live price
  exclude?: string; // the live player kept out
};

/** The best squad the purse can still buy, filled to the minimum squad size. */
export function buildPlan(key: StrategyKey, inp: PlanInput): Plan {
  const { rules } = inp;
  const squad = inp.mine.slice();
  const cats: Record<PlanCat, number> = { "A+": 0, A: 0, B: 0, Special: 0 };
  for (const p of squad) cats[p.cat] += 1;
  let budget = inp.purseLeft;
  const target = Math.max(rules.squadMin, 12);
  // Keep enough back to fill every remaining place at B base (Special slots run out fast).
  const minB = rules.base.B;
  const buys: Rated[] = [];
  const take = (p: Rated, price: number) => {
    const q = { ...p, price };
    squad.push(q); buys.push(q); cats[p.cat] += 1; budget -= price;
  };
  const room = (p: Rated) => cats[p.cat] < rules.cap[p.cat] && squad.length < rules.squadMax;
  const reserve = () => Math.max(0, target - squad.length - 1) * minB;

  const avail = inp.rated.filter((p) => !p.team_id && !inp.rejected.has(p.id) && p.id !== inp.exclude && p.id !== inp.forced?.id);
  if (inp.forced) {
    const f = inp.rated.find((p) => p.id === inp.forced!.id);
    if (f && room(f)) take(f, inp.forced.price);
  }
  for (const p of avail.filter((p) => inp.going.has(p.id))) if (room(p) && p.price <= budget - reserve()) take(p, p.price);

  // Shortlist: the strongest by rating plus the cheapest, so the greedy fill stays quick.
  const strength = (p: Rated) => p.bat + p.bowl;
  const pool = new Set([...avail.slice().sort((a, b) => strength(b) - strength(a)).slice(0, 220), ...avail.slice().sort((a, b) => a.price - b.price).slice(0, 60)]);
  const cand = [...pool].filter((p) => !inp.going.has(p.id));

  // The score only reads the top 7 batters and top 5 bowlers, so scoring the whole
  // squad gives the same gain as re-picking the twelve, far faster.
  while (squad.length < target) {
    const base = scoreOf(squad).score;
    const have = new Set(squad.map((s) => s.id));
    let best: Rated | null = null, bestV = -Infinity;
    for (const p of cand) {
      if (have.has(p.id) || !room(p) || p.price > budget - reserve()) continue;
      const gain = (scoreOf([...squad, p]).score - base) * tilt(key, p);
      // Gain first; once the XII is settled, cheap depth with the best numbers.
      const v = gain > 0.5 ? gain * 1000 - p.price / 1000 : strength(p) * tilt(key, p) - p.price / 2000;
      if (v > bestV) { bestV = v; best = p; }
    }
    if (!best) break;
    take(best, best.price);
  }

  // Greedy filling depends on the order of picks, so polish it: swap any free
  // pick (not owned, not "going", not the live player) for a pool player while
  // that makes the squad better for this strategy, or as good for less money.
  const fixed = new Set([...inp.mine.map((p) => p.id), ...inp.going, ...(inp.forced ? [inp.forced.id] : [])]);
  const objective = (xs: Rated[]) =>
    scoreOf(xs).score + 0.3 * xs.reduce((a, p) => a + (tilt(key, p) - 1) * (p.bat + p.bowl), 0);
  const swaps = [...new Set([...cand.slice().sort((a, b) => strength(b) - strength(a)).slice(0, 120), ...cand.slice().sort((a, b) => a.price - b.price).slice(0, 40)])];
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (let i = 0; i < squad.length; i++) {
      const out = squad[i];
      if (fixed.has(out.id)) continue;
      const cur = objective(squad);
      const have = new Set(squad.map((x) => x.id));
      let bestJ: Rated | null = null, bestGain = 0;
      for (const c of swaps) {
        if (have.has(c.id) || c.price > budget + out.price) continue;
        if (c.cat !== out.cat && cats[c.cat] >= rules.cap[c.cat]) continue;
        const next = squad.slice();
        next[i] = c;
        const gain = objective(next) - cur + (out.price - c.price) / 1e7; // cheaper wins a tie
        if (gain > bestGain + 1e-9) { bestGain = gain; bestJ = c; }
      }
      if (bestJ) {
        cats[out.cat] -= 1; cats[bestJ.cat] += 1;
        budget += out.price - bestJ.price;
        squad[i] = bestJ;
        const k = buys.findIndex((b) => b.id === out.id);
        if (k >= 0) buys[k] = bestJ;
        improved = true;
      }
    }
    if (!improved) break;
  }
  return { key, squad, buys, cost: buys.reduce((a, b) => a + b.price, 0), xii: bestXII(squad) };
}

// ---- the live verdict ----------------------------------------------------------------
export type Verdict = {
  worth: boolean;
  canBuy: boolean;
  ceiling: number; // the most this squad should pay
  xiiWithout: number;
  xiiWith: number;
  chance: number; // 0–10: how often he ends up ours at our ceiling
  why: string[];
  risk: string[];
  alternatives: Rated[];
};

export function liveVerdict(
  p: Rated,
  bid: number,
  inp: Omit<PlanInput, "forced" | "exclude">,
  ctx: { maxSafe: number; slotOpen: boolean; gaps: string[]; rivalCaps: number[] },
): Verdict {
  const without = buildPlan("balanced", { ...inp, exclude: p.id });
  // Greedy filling is path-dependent: forcing him first can crowd out a later
  // pick and score lower than passing, even for a star at base. So also try the
  // plan we'd follow without him, plus him, dropping whichever planned buys cost
  // the least strength until the squad fits the purse and size again — and keep the better.
  const swapIn = (price: number): Plan => {
    const target = Math.max(inp.rules.squadMin, 12);
    let buys = [...without.buys];
    const him = { ...p, price };
    const fits = () => buys.reduce((a, b) => a + b.price, 0) + price <= inp.purseLeft && inp.mine.length + buys.length + 1 <= Math.max(target, inp.mine.length + 1);
    while (buys.length && !fits()) {
      let drop = 0, best = -Infinity;
      for (let i = 0; i < buys.length; i++) {
        const rest = buys.filter((_, j) => j !== i);
        const v = scoreOf([...inp.mine, him, ...rest]).score + buys[i].price / 100000;
        if (v > best) { best = v; drop = i; }
      }
      buys = buys.filter((_, j) => j !== drop);
    }
    const squad = [...inp.mine, him, ...buys];
    return { key: "balanced", squad, buys: [him, ...buys], cost: price + buys.reduce((a, b) => a + b.price, 0), xii: bestXII(squad) };
  };
  const withAt = (price: number) => {
    const a = buildPlan("balanced", { ...inp, forced: { id: p.id, price } });
    if (price > inp.purseLeft) return a;
    const b = swapIn(price);
    return b.xii.score > a.xii.score ? b : a;
  };
  const canBuy = ctx.slotOpen && bid <= ctx.maxSafe;
  const at = canBuy ? withAt(bid) : without;
  const gainAtBid = at.xii.score - without.xii.score;

  // Highest price at which buying him still leaves a better squad than passing —
  // searched from his base, so it doesn't move with the bid.
  let ceiling = 0;
  const base = inp.rules.base[p.cat];
  if (ctx.slotOpen && base <= ctx.maxSafe && withAt(base).xii.score - without.xii.score > 0) {
    let lo = base, hi = ctx.maxSafe;
    for (let i = 0; i < 6 && hi - lo > 2000; i++) {
      const mid = Math.round((lo + hi) / 2 / 1000) * 1000;
      if (withAt(mid).xii.score - without.xii.score > 0) lo = mid; else hi = mid;
    }
    ceiling = lo;
  }
  const worth = canBuy && gainAtBid > 0 && bid <= ceiling;
  const beaters = ctx.rivalCaps.filter((c) => c > ceiling).length;
  const chance = !worth ? 0 : Math.max(0, Math.min(10, Math.round(10 / (1 + beaters))));

  const why: string[] = [];
  if (!ctx.slotOpen) why.push(`His ${p.cat} slot is full.`);
  else if (bid > ctx.maxSafe) why.push(`The bid is above our max safe bid.`);
  else if (worth) why.push(`Our XII goes from ${without.xii.score} to ${at.xii.score} runs a match at this price.`);
  else why.push(`Not worth it for this squad: our XII is ${gainAtBid < 0 ? `${Math.abs(gainAtBid)} runs a match weaker` : "no stronger"} with him at this price.`);
  if (ctx.gaps.length) why.push(`Fills: ${ctx.gaps.join(", ")}.`);
  const m = p.bat_matches ?? 0;
  if (m > 0) why.push(`${m} matches · ${p.runs ?? 0} runs${p.bat_avg != null ? ` at ${p.bat_avg}` : ""}${p.bat_sr != null ? `, SR ${p.bat_sr}` : ""}${(p.wickets ?? 0) > 0 ? ` · ${p.wickets} wickets${p.economy != null ? `, econ ${p.economy}` : ""}` : ""}.`);

  const risk: string[] = [];
  if (p.data === "none") risk.push("No match data yet: rated at his category's median.");
  else if (p.data === "thin") risk.push(`Only ${m} matches on record: little evidence.`);
  if (beaters) risk.push(`${beaters} rival${beaters > 1 ? "s" : ""} can pay more than our ceiling.`);
  if (worth && ceiling < ctx.maxSafe && ceiling - bid < 5000) risk.push("Close to our ceiling already.");
  if (!risk.length) risk.push("Nothing stands out.");

  const similar = (q: Rated) => q.id !== p.id && !q.team_id && !inp.rejected.has(q.id) && (p.keeper ? q.keeper : p.bowler === q.bowler);
  const alternatives = inp.rated
    .filter((q) => similar(q) && q.price <= ctx.maxSafe)
    .sort((a, b) => b.bat + b.bowl - (a.bat + a.bowl))
    .slice(0, 3);

  return { worth, canBuy, ceiling, xiiWithout: without.xii.score, xiiWith: at.xii.score, chance, why, risk, alternatives };
}
