// Player Index engine — transparent, percentile-based, tunable.
//
// Every input metric is normalized to a 0-100 PERCENTILE across the pool (robust
// to the fat-finger outliers we know exist in these exports). Sub-indices are
// weighted blends of those percentiles; the overall index is a role-aware blend
// of the sub-indices. All weights live here as named constants so they're easy
// to inspect and tune.

export type RawStats = {
  // batting
  bat_matches: number | null;
  bat_innings: number | null;
  not_out: number | null;
  runs: number | null;
  bat_avg: number | null;
  bat_sr: number | null;
  fifties: number | null;
  hundreds: number | null;
  fours: number | null;
  sixes: number | null;
  // bowling
  bowl_matches: number | null;
  overs: number | null;
  wickets: number | null;
  economy: number | null;
  bowl_avg: number | null;
  bowl_sr: number | null;
  dot_balls: number | null;
  five_w: number | null;
  // fielding
  catches: number | null;
  run_outs: number | null;
  // keeping
  is_keeper: boolean;
  stumpings: number | null;
  keeping_catches: number | null;
  // role hint
  primary_role: string | null;
};

export type IndexScores = {
  bat_index: number;
  bowl_index: number;
  field_index: number;
  keep_index: number | null;
  overall_index: number;
};

export type DerivedMetrics = {
  boundaryPct: number | null;
  ballsPerBoundary: number | null;
  dotBallShare: number | null;
  finishingRate: number | null;
  wicketsPerMatch: number | null;
  catchesPerMatch: number | null;
  runOutsPerMatch: number | null;
  stumpingsPerMatch: number | null;
};

const num = (v: number | null | undefined): number | null =>
  v == null || Number.isNaN(v) ? null : v;

// ---- derived advanced metrics ----------------------------------------------

export function deriveMetrics(s: RawStats): DerivedMetrics {
  const runs = num(s.runs);
  const fours = num(s.fours);
  const sixes = num(s.sixes);
  const innings = num(s.bat_innings);
  const notOut = num(s.not_out);
  const bowlMatches = num(s.bowl_matches);
  const wickets = num(s.wickets);
  const catches = num(s.catches);
  const runOuts = num(s.run_outs);
  const stumpings = num(s.stumpings);

  const boundaryRuns =
    fours != null && sixes != null ? fours * 4 + sixes * 6 : null;
  const boundaries =
    fours != null && sixes != null ? fours + sixes : null;
  const sr = num(s.bat_sr);
  const ballsFaced =
    runs != null && sr != null && sr > 0 ? (runs * 100) / sr : null;

  return {
    boundaryPct:
      boundaryRuns != null && runs != null && runs > 0
        ? (boundaryRuns / runs) * 100
        : null,
    ballsPerBoundary:
      ballsFaced != null && boundaries != null && boundaries > 0
        ? ballsFaced / boundaries
        : null,
    dotBallShare: num(s.dot_balls), // more dots = better bowler; used as-is percentile
    finishingRate:
      notOut != null && innings != null && innings > 0
        ? (notOut / innings) * 100
        : null,
    wicketsPerMatch:
      wickets != null && bowlMatches != null && bowlMatches > 0
        ? wickets / bowlMatches
        : null,
    catchesPerMatch:
      catches != null && bowlMatches != null && bowlMatches > 0
        ? catches / bowlMatches
        : null,
    runOutsPerMatch:
      runOuts != null && bowlMatches != null && bowlMatches > 0
        ? runOuts / bowlMatches
        : null,
    stumpingsPerMatch:
      stumpings != null && bowlMatches != null && bowlMatches > 0
        ? stumpings / bowlMatches
        : null,
  };
}

// ---- percentile normalization ----------------------------------------------

// Percentile of each value within the set of non-null values (0-100).
// `invert` flips it so that LOWER raw values score higher (economy, bowl avg).
function percentileColumn(values: (number | null)[], invert = false): (number | null)[] {
  const present = values.filter((v): v is number => v != null).sort((a, b) => a - b);
  if (present.length === 0) return values.map(() => null);
  if (present.length === 1) return values.map((v) => (v == null ? null : 50));

  return values.map((v) => {
    if (v == null) return null;
    // fraction of values strictly below + half of ties => stable mid-rank percentile
    let below = 0;
    let equal = 0;
    for (const p of present) {
      if (p < v) below++;
      else if (p === v) equal++;
    }
    const pct = ((below + equal / 2) / present.length) * 100;
    return invert ? 100 - pct : pct;
  });
}

// ---- weights (documented, tunable) -----------------------------------------

const BAT_W = { avg: 25, sr: 25, runs: 15, boundary: 15, conversion: 10, finishing: 10 };
const BOWL_W = { economy: 25, wickets: 20, avg: 20, sr: 15, dots: 10, fiveW: 10 };
const FIELD_W = { catches: 60, runOuts: 40 };
const KEEP_W = { stumpings: 55, catches: 45 };

// role-aware overall blend (sub-index weights). Sums to 100 within each profile.
const OVERALL_PROFILES = {
  batter: { bat: 70, bowl: 10, field: 18, keep: 2 },
  bowler: { bat: 12, bowl: 70, field: 16, keep: 2 },
  allrounder: { bat: 38, bowl: 38, field: 18, keep: 6 },
  keeper: { bat: 55, bowl: 3, field: 12, keep: 30 },
};

function profileFor(role: string | null, isKeeper: boolean): keyof typeof OVERALL_PROFILES {
  if (isKeeper) return "keeper";
  const r = (role ?? "").toLowerCase();
  if (r.includes("keep")) return "keeper";
  if (r.includes("all")) return "allrounder";
  if (r.includes("bowl") || r.includes("spin") || r.includes("fast")) return "bowler";
  if (r.includes("bat")) return "batter";
  return "allrounder";
}

// weighted average over the entries whose percentile is non-null (re-normalizes
// weights so a missing metric doesn't drag the score to zero).
function blend(parts: { pct: number | null; w: number }[]): number | null {
  let sum = 0;
  let wSum = 0;
  for (const { pct, w } of parts) {
    if (pct == null) continue;
    sum += pct * w;
    wSum += w;
  }
  return wSum === 0 ? null : sum / wSum;
}

// ---- main entry: compute indices for the whole pool ------------------------

export function computeIndices(players: RawStats[]): IndexScores[] {
  const derived = players.map(deriveMetrics);

  // small-sample guard: players below these thresholds get their batting/bowling
  // percentiles pulled toward the pool mean (50) so tiny samples don't top charts.
  const MIN_BAT_INNINGS = 5;
  const MIN_BOWL_MATCHES = 5;

  // batting percentile columns
  const pAvg = percentileColumn(players.map((p) => num(p.bat_avg)));
  const pSr = percentileColumn(players.map((p) => num(p.bat_sr)));
  const pRuns = percentileColumn(players.map((p) => num(p.runs)));
  const pBoundary = percentileColumn(derived.map((d) => d.boundaryPct));
  const pConversion = percentileColumn(
    players.map((p) =>
      num(p.hundreds) != null && num(p.fifties) != null
        ? (num(p.hundreds)! * 2 + num(p.fifties)!)
        : null
    )
  );
  const pFinishing = percentileColumn(derived.map((d) => d.finishingRate));

  // bowling percentile columns (economy/avg/sr inverted: lower is better)
  const pEcon = percentileColumn(players.map((p) => num(p.economy)), true);
  const pWkts = percentileColumn(derived.map((d) => d.wicketsPerMatch));
  const pBowlAvg = percentileColumn(players.map((p) => num(p.bowl_avg)), true);
  const pBowlSr = percentileColumn(players.map((p) => num(p.bowl_sr)), true);
  const pDots = percentileColumn(players.map((p) => num(p.dot_balls)));
  const pFiveW = percentileColumn(players.map((p) => num(p.five_w)));

  // fielding & keeping
  const pCatches = percentileColumn(derived.map((d) => d.catchesPerMatch));
  const pRunOuts = percentileColumn(derived.map((d) => d.runOutsPerMatch));
  const pStumpings = percentileColumn(derived.map((d) => d.stumpingsPerMatch));
  const pKeepCatches = percentileColumn(
    players.map((p) =>
      num(p.keeping_catches) != null && num(p.bowl_matches) != null && num(p.bowl_matches)! > 0
        ? num(p.keeping_catches)! / num(p.bowl_matches)!
        : null
    )
  );

  const pull = (pct: number | null, ok: boolean): number | null =>
    pct == null ? null : ok ? pct : (pct + 50) / 2;

  return players.map((p, i) => {
    const batOk = (num(p.bat_innings) ?? 0) >= MIN_BAT_INNINGS;
    const bowlOk = (num(p.bowl_matches) ?? 0) >= MIN_BOWL_MATCHES;

    const bat =
      blend([
        { pct: pull(pAvg[i], batOk), w: BAT_W.avg },
        { pct: pull(pSr[i], batOk), w: BAT_W.sr },
        { pct: pRuns[i], w: BAT_W.runs },
        { pct: pull(pBoundary[i], batOk), w: BAT_W.boundary },
        { pct: pConversion[i], w: BAT_W.conversion },
        { pct: pull(pFinishing[i], batOk), w: BAT_W.finishing },
      ]) ?? 0;

    const bowl =
      blend([
        { pct: pull(pEcon[i], bowlOk), w: BOWL_W.economy },
        { pct: pWkts[i], w: BOWL_W.wickets },
        { pct: pull(pBowlAvg[i], bowlOk), w: BOWL_W.avg },
        { pct: pull(pBowlSr[i], bowlOk), w: BOWL_W.sr },
        { pct: pDots[i], w: BOWL_W.dots },
        { pct: pFiveW[i], w: BOWL_W.fiveW },
      ]) ?? 0;

    const field =
      blend([
        { pct: pCatches[i], w: FIELD_W.catches },
        { pct: pRunOuts[i], w: FIELD_W.runOuts },
      ]) ?? 0;

    const hasKeepData =
      p.is_keeper || num(p.stumpings) != null || num(p.keeping_catches) != null;
    const keep = hasKeepData
      ? blend([
          { pct: pStumpings[i], w: KEEP_W.stumpings },
          { pct: pKeepCatches[i], w: KEEP_W.catches },
        ])
      : null;

    const profile = OVERALL_PROFILES[profileFor(p.primary_role, p.is_keeper)];
    const overall =
      blend([
        { pct: bat, w: profile.bat },
        { pct: bowl, w: profile.bowl },
        { pct: field, w: profile.field },
        { pct: keep, w: profile.keep },
      ]) ?? 0;

    return {
      bat_index: round(bat),
      bowl_index: round(bowl),
      field_index: round(field),
      keep_index: keep == null ? null : round(keep),
      overall_index: round(overall),
    };
  });
}

const round = (n: number) => Math.round(n * 10) / 10;

// ---- utility tag + suggested order (used when a player is bought) -----------

export function utilityTag(p: RawStats, idx: IndexScores): string {
  if (p.is_keeper || (idx.keep_index ?? 0) >= 60) return "Wicketkeeper";

  const bat = idx.bat_index;
  const bowl = idx.bowl_index;
  const sr = num(p.bat_sr) ?? 0;

  if (bat >= 55 && bowl >= 55) return "All-rounder";
  if (bowl > bat + 10) {
    return (num(p.economy) ?? 99) <= 7 ? "Death-overs bowler" : "Frontline bowler";
  }
  if (bat >= 55) return sr >= 140 ? "Aggressive top-order" : "Top-order anchor";
  return "Middle-order / utility";
}
