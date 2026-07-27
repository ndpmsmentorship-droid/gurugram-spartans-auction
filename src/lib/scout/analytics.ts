// Advanced decision analytics computed over the WHOLE pool (n≈290, cheap):
// Value Over Replacement, explainable archetypes, "players like X" similarity,
// risk flags, and a squad-need-weighted fit score. Everything is derived from
// what's already stored on scout_players — no external service.

import { deriveMetrics, hasRecentForm, type RawStats } from "./rankings";

export type RoleGroup = "Batter" | "Bowler" | "All-rounder" | "Keeper" | "Other";

export type AnalyticsInput = RawStats & {
  id: string;
  age: number | null;
  ducks: number | null;
  bat_index: number | null;
  bowl_index: number | null;
  field_index: number | null;
  keep_index: number | null;
  overall_index: number | null;
  is_keeper: boolean;
  is_bought: boolean;
};

export type RiskFlag = {
  level: "amber" | "red";
  label: string;
};

export type PlayerAnalytics = {
  id: string;
  roleGroup: RoleGroup;
  archetype: string;
  vor: number; // points above replacement level for the role
  riskFlags: RiskFlag[];
  similarIds: string[]; // nearest 4
  hasRecentForm: boolean; // index is form-adjusted for this player
};

const n = (v: number | null | undefined): number | null =>
  v == null || Number.isNaN(v) ? null : v;

export function roleGroup(role: string | null, isKeeper: boolean): RoleGroup {
  if (isKeeper) return "Keeper";
  const r = (role ?? "").toLowerCase();
  if (r.includes("keep") || r.includes("wk")) return "Keeper";
  if (r.includes("all")) return "All-rounder";
  if (r.includes("bowl") || r.includes("spin") || r.includes("fast") || r.includes("pace"))
    return "Bowler";
  if (r.includes("bat")) return "Batter";
  return "Other";
}

// ---- archetype (explainable, rule-based) -----------------------------------

function archetype(p: AnalyticsInput): string {
  const bat = p.bat_index ?? 0;
  const bowl = p.bowl_index ?? 0;
  const sr = n(p.bat_sr) ?? 0;
  const econ = n(p.economy) ?? 99;

  if (p.is_keeper || (p.keep_index ?? 0) >= 60) return "Keeper-batter";
  if (bat >= 55 && bowl >= 55) {
    return bat >= bowl ? "Batting all-rounder" : "Bowling all-rounder";
  }
  if (bowl > bat + 12) {
    return econ <= 7 ? "Containment bowler" : "Strike bowler";
  }
  if (bat >= 55) return sr >= 140 ? "Power-hitter" : "Anchor";
  return "Utility";
}

// ---- VOR: overall_index minus role's 25th-percentile overall ---------------

function replacementLevels(players: AnalyticsInput[]): Map<RoleGroup, number> {
  const byRole = new Map<RoleGroup, number[]>();
  for (const p of players) {
    if (p.overall_index == null) continue;
    const g = roleGroup(p.primary_role, p.is_keeper);
    const arr = byRole.get(g) ?? [];
    arr.push(p.overall_index);
    byRole.set(g, arr);
  }
  const repl = new Map<RoleGroup, number>();
  for (const [g, vals] of byRole) {
    const sorted = [...vals].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.25);
    repl.set(g, sorted[Math.min(idx, sorted.length - 1)] ?? 0);
  }
  return repl;
}

// ---- similarity: z-scored Euclidean on a feature vector --------------------

function zColumns(players: AnalyticsInput[]): number[][] {
  const feats = (p: AnalyticsInput) => [
    p.bat_index ?? 0,
    p.bowl_index ?? 0,
    p.field_index ?? 0,
    p.keep_index ?? 0,
    n(p.bat_sr) ?? 0,
    n(p.economy) ?? 0,
  ];
  const raw = players.map(feats);
  const dim = raw[0]?.length ?? 0;
  const means: number[] = [];
  const stds: number[] = [];
  for (let d = 0; d < dim; d++) {
    const col = raw.map((r) => r[d]);
    const mean = col.reduce((a, b) => a + b, 0) / col.length;
    const variance = col.reduce((a, b) => a + (b - mean) ** 2, 0) / col.length;
    means.push(mean);
    stds.push(Math.sqrt(variance) || 1);
  }
  return raw.map((r) => r.map((v, d) => (v - means[d]) / stds[d]));
}

// ---- risk flags ------------------------------------------------------------

function riskFlags(p: AnalyticsInput): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const d = deriveMetrics(p);

  const batInn = n(p.bat_innings) ?? 0;
  const bowlM = n(p.bowl_matches) ?? 0;
  if (batInn < 5 && bowlM < 5) {
    flags.push({ level: "red", label: "Thin sample" });
  } else if (batInn < 8 && bowlM < 8) {
    flags.push({ level: "amber", label: "Small sample" });
  }

  const age = n(p.age);
  if (age != null && age >= 45) flags.push({ level: "red", label: `Age ${age}` });
  else if (age != null && age >= 40) flags.push({ level: "amber", label: `Age ${age}` });

  if (d.boundaryPct != null && d.boundaryPct > 70) {
    flags.push({ level: "amber", label: "Boundary-dependent" });
  }

  const ducks = n(p.ducks);
  if (ducks != null && batInn > 0 && ducks / batInn > 0.15) {
    flags.push({ level: "amber", label: "High duck rate" });
  }

  const hasKeepData =
    p.is_keeper || n(p.stumpings) != null || n(p.keeping_catches) != null;
  if (n(p.catches) == null && n(p.run_outs) == null && !hasKeepData) {
    flags.push({ level: "amber", label: "No fielding data" });
  }

  return flags;
}

// ---- squad-need fit --------------------------------------------------------

// target squad shape for a T20-style XI + bench
const TARGET = { batting: 8, bowling: 7, keepers: 2 };

export type SquadNeeds = {
  battingHave: number;
  bowlingHave: number;
  keepersHave: number;
};

export function squadNeeds(bought: AnalyticsInput[]): SquadNeeds {
  let batting = 0;
  let bowling = 0;
  let keepers = 0;
  for (const p of bought) {
    const g = roleGroup(p.primary_role, p.is_keeper);
    if (g === "Keeper") keepers++;
    if (g === "Batter" || g === "All-rounder" || g === "Keeper") batting++;
    if (g === "Bowler" || g === "All-rounder") bowling++;
  }
  return { battingHave: batting, bowlingHave: bowling, keepersHave: keepers };
}

// multiplier > 1 for under-filled roles, < 1 for filled ones
export function fitMultiplier(g: RoleGroup, needs: SquadNeeds): number {
  const battingGap = Math.max(0, TARGET.batting - needs.battingHave) / TARGET.batting;
  const bowlingGap = Math.max(0, TARGET.bowling - needs.bowlingHave) / TARGET.bowling;
  const keeperGap = Math.max(0, TARGET.keepers - needs.keepersHave) / TARGET.keepers;

  switch (g) {
    case "Batter":
      return 0.6 + 0.8 * battingGap;
    case "Bowler":
      return 0.6 + 0.8 * bowlingGap;
    case "All-rounder":
      return 0.7 + 0.5 * battingGap + 0.5 * bowlingGap;
    case "Keeper":
      return 0.5 + 1.2 * keeperGap;
    default:
      return 0.8;
  }
}

export function fitScore(
  p: AnalyticsInput,
  needs: SquadNeeds
): number {
  const g = roleGroup(p.primary_role, p.is_keeper);
  return (p.overall_index ?? 0) * fitMultiplier(g, needs);
}

// ---- main entry: analytics for the whole pool ------------------------------

export function computeAnalytics(players: AnalyticsInput[]): Map<string, PlayerAnalytics> {
  const repl = replacementLevels(players);
  const z = zColumns(players);

  const result = new Map<string, PlayerAnalytics>();
  players.forEach((p, i) => {
    const g = roleGroup(p.primary_role, p.is_keeper);

    // nearest neighbours by z-scored euclidean distance
    const dists = players
      .map((q, j) => {
        if (j === i) return { id: q.id, d: Infinity };
        let s = 0;
        for (let d = 0; d < z[i].length; d++) s += (z[i][d] - z[j][d]) ** 2;
        return { id: q.id, d: s };
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, 4)
      .map((x) => x.id);

    result.set(p.id, {
      id: p.id,
      roleGroup: g,
      archetype: archetype(p),
      vor: Math.round(((p.overall_index ?? 0) - (repl.get(g) ?? 0)) * 10) / 10,
      riskFlags: riskFlags(p),
      similarIds: dists,
      hasRecentForm: hasRecentForm(p),
    });
  });
  return result;
}
