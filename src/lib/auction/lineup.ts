// The planner's batting order and bowling attack (Nikhil, 12 Nov 2026):
//   XII in four bands — top order 1–3, upper middle 4–6, lower middle 7–9, tail 10–12 — with the
//   Legend always at #4; five bowlers split into opening spell (2), middle overs (3), death (2).
// Every band and bowling role also names the best player still available in the pool.
//
// Numbers come from the ND Cric Videos Ball Library (src/data/role-stats.json, built by
// scripts/build-role-stats.mjs): batting position share and phase strike rates / economies.
// A phase figure is used only with at least MIN_BALLS behind it; otherwise the player's
// CricHeroes career figure stands in, and the line says so.
import roleStats from "@/data/role-stats.json";
import cvMap from "@/data/cv-map.json";
import type { Rated } from "./planner";

type BatPhase = { r: number; b: number; out: number };
type BowlPhase = { b: number; r: number; w: number };
type Lib = {
  bat?: { inns: number; pos: Record<Band, number>; pp: BatPhase; mid: BatPhase; death: BatPhase };
  bowl?: { pp: BowlPhase; mid: BowlPhase; death: BowlPhase };
};
const ROLE = roleStats as unknown as { matches: number; players: Record<string, Lib> };
const CV = cvMap as Record<string, { batter?: string; bowler?: string }>;
export const LIBRARY_MATCHES = ROLE.matches;

const MIN_BALLS = 12;
export type Band = "top" | "upper" | "lower" | "tail";
export type Phase = "pp" | "mid" | "death";

export const BANDS: { key: Band; label: string; range: string }[] = [
  { key: "top", label: "Top order", range: "1–3" },
  { key: "upper", label: "Upper middle", range: "4–6" },
  { key: "lower", label: "Lower middle", range: "7–9" },
  { key: "tail", label: "Tail", range: "10–12" },
];
export const SPELLS: { key: Phase; label: string; count: number }[] = [
  { key: "pp", label: "Opening spell", count: 2 },
  { key: "mid", label: "Middle overs", count: 3 },
  { key: "death", label: "Death", count: 2 },
];
const BAND_PHASE: Record<Band, Phase> = { top: "pp", upper: "mid", lower: "death", tail: "death" };
const PHASE_NAME: Record<Phase, string> = { pp: "PP", mid: "Middle", death: "Death" };

const libBat = (p: Rated) => {
  const n = CV[p.full_name]?.batter ?? CV[p.full_name]?.bowler;
  return n ? ROLE.players[n]?.bat : undefined;
};
const libBowl = (p: Rated) => {
  const n = CV[p.full_name]?.bowler ?? CV[p.full_name]?.batter;
  return n ? ROLE.players[n]?.bowl : undefined;
};

export type Note = { text: string; library: boolean };

/** Strike rate in a phase: Ball Library when there's enough of it, else CricHeroes career. */
function batSR(p: Rated, ph: Phase): { sr: number | null; note: Note } {
  const s = libBat(p)?.[ph];
  if (s && s.b >= MIN_BALLS) {
    const sr = Math.round((s.r / s.b) * 100);
    return { sr, note: { text: `${PHASE_NAME[ph]} SR ${sr} · ${s.b} balls`, library: true } };
  }
  return { sr: p.bat_sr, note: { text: p.bat_sr != null ? `SR ${Math.round(p.bat_sr)} · career` : "No numbers yet", library: false } };
}

/** Economy in a phase: Ball Library when there's enough of it, else CricHeroes career. */
function econ(p: Rated, ph: Phase): { e: number | null; note: Note } {
  const s = libBowl(p)?.[ph];
  if (s && s.b >= MIN_BALLS) {
    const e = Math.round((s.r / s.b) * 6 * 10) / 10;
    return { e, note: { text: `${PHASE_NAME[ph]} econ ${e} · ${s.w}w in ${s.b} balls`, library: true } };
  }
  return { e: p.economy, note: { text: p.economy != null ? `Econ ${p.economy} · career` : "No numbers yet", library: false } };
}

const share = (p: Rated, band: Band) => {
  const b = libBat(p);
  return b && b.inns >= 2 ? b.pos[band] / b.inns : 0;
};

// How well a batter suits a band: his value (runs a match), lifted by how often he has batted
// there and by his strike rate in that band's phase.
function bandFit(p: Rated, band: Band): number {
  const { sr } = batSR(p, BAND_PHASE[band]);
  const pace = sr ? Math.sqrt(Math.max(40, sr) / 130) : 1;
  return p.bat * (1 + 0.6 * share(p, band)) * pace;
}
// Lower is better for an economy; 99 = unknown, never first choice.
const ecoKey = (p: Rated, ph: Phase) => econ(p, ph).e ?? 99;

function bandNote(p: Rated, band: Band): Note {
  const b = libBat(p);
  const n = batSR(p, BAND_PHASE[band]).note;
  if (b && b.inns >= 2 && b.pos[band] > 0 && band !== "tail")
    return { text: `${n.text} · batted ${BANDS.find((x) => x.key === band)!.range} in ${b.pos[band]} of ${b.inns}`, library: true }; // position history is Ball Library data
  return n;
}

export type Slot = { pos: number; p: Rated; note: Note; legend?: boolean };
export type Pick = { p: Rated; note: Note } | null;
export type Opt = { p: Rated; note: Note };
export const OPTIONS = 6; // best-available options per band / spell (3 shown, 3 more on tap)
export type Lineup = {
  bands: { key: Band; label: string; range: string; slots: Slot[]; best: Opt[] }[];
  attack: Rated[];
  spells: { key: Phase; label: string; picks: { p: Rated; note: Note }[]; best: Opt[] }[];
  hasLegend: boolean;
};

export function buildLineup(twelve: Rated[], available: Rated[]): Lineup {
  const legends = twelve.filter((p) => p.cat === "Special").sort((a, b) => b.bat - a.bat);
  const legend = legends[0];
  const rest = twelve.filter((p) => p !== legend);

  // tail: the three weakest bats; then the best top-order fits, the best finishers, and the rest
  const byBat = [...rest].sort((a, b) => a.bat - b.bat);
  const tail = byBat.slice(0, Math.max(0, Math.min(3, rest.length - 6)));
  let left = rest.filter((p) => !tail.includes(p));
  const take = (band: Band, n: number) => {
    const got = [...left].sort((a, b) => bandFit(b, band) - bandFit(a, band)).slice(0, n);
    left = left.filter((p) => !got.includes(p));
    return got;
  };
  const top = take("top", 3);
  const lower = take("lower", 3);
  const upper = left.sort((a, b) => bandFit(b, "upper") - bandFit(a, "upper"));
  if (legend) upper.unshift(legend); // the Legend always bats at #4

  const ordered: [Band, Rated[]][] = [
    ["top", top],
    ["upper", upper],
    ["lower", lower],
    ["tail", tail.sort((a, b) => b.bat - a.bat)],
  ];
  let pos = 0;
  // each suggestion names a different player
  const suggested = new Set<string>();
  const best = (fit: (p: Rated) => number, note: (p: Rated) => Note, ok: (p: Rated) => boolean = () => true): Opt[] => {
    const ps = available.filter((x) => !suggested.has(x.id) && ok(x)).sort((a, b) => fit(b) - fit(a)).slice(0, OPTIONS);
    ps.forEach((p) => suggested.add(p.id));
    return ps.map((p) => ({ p, note: note(p) }));
  };
  const bands = ordered.map(([key, ps]) => {
    const meta = BANDS.find((b) => b.key === key)!;
    const slots = ps.map((p) => ({ pos: ++pos, p, note: bandNote(p, key), legend: p === legend }));
    // the tail's "best available" is a bowler who can hold a bat, so it's skipped
    const pick =
      key === "tail"
        ? []
        : best((p) => bandFit(p, key), (p) => bandNote(p, key));
    return { ...meta, slots, best: pick };
  });

  // five bowlers: the best bowling values in the XII
  const attack = twelve.filter((p) => p.bowler).sort((a, b) => b.bowl - a.bowl).slice(0, 5);
  // All five bowl and nobody covers all three spells: the two best death bowlers close, the two
  // best of the others open, and the middle overs take whoever is left plus the two best there.
  const byEco = (xs: Rated[], ph: Phase) => [...xs].sort((a, b) => ecoKey(a, ph) - ecoKey(b, ph));
  const death = byEco(attack, "death").slice(0, 2);
  const others = attack.filter((p) => !death.includes(p));
  const open = byEco(others.length >= 2 ? others : attack, "pp").slice(0, 2);
  const unused = attack.filter((p) => !death.includes(p) && !open.includes(p));
  const middle = [...unused, ...byEco(attack.filter((p) => !unused.includes(p)), "mid")].slice(0, 3);
  const chosenFor: Record<Phase, Rated[]> = { pp: open, mid: byEco(middle, "mid"), death };

  const spells = SPELLS.map(({ key, label }) => {
    const picks = chosenFor[key].map((p) => ({ p, note: econ(p, key).note }));
    // best available: the lowest economy for this phase (Ball Library where it has enough balls,
    // career otherwise)
    const pick = best((p) => -ecoKey(p, key), (p) => econ(p, key).note, (p) => p.bowler && econ(p, key).e != null);
    return { key, label, picks, best: pick };
  });

  return { bands, attack, spells, hasLegend: !!legend };
}

/** A player's Ball Library numbers for his profile sheet: positions batted, and every phase
 *  with balls behind it (no minimum here — the ball counts are shown). */
export function libraryCard(p: { full_name: string }) {
  const bn = CV[p.full_name]?.batter ?? CV[p.full_name]?.bowler;
  const wn = CV[p.full_name]?.bowler ?? CV[p.full_name]?.batter;
  const bat = bn ? ROLE.players[bn]?.bat : undefined;
  const bowl = wn ? ROLE.players[wn]?.bowl : undefined;
  const phases: Phase[] = ["pp", "mid", "death"];
  return {
    bat: bat
      ? {
          inns: bat.inns,
          pos: BANDS.map((b) => ({ label: b.range, n: bat.pos[b.key] })),
          phases: phases.filter((ph) => bat[ph].b > 0).map((ph) => ({ k: PHASE_NAME[ph], sr: Math.round((bat[ph].r / bat[ph].b) * 100), r: bat[ph].r, b: bat[ph].b, out: bat[ph].out })),
        }
      : null,
    bowl: bowl
      ? phases.filter((ph) => bowl[ph].b > 0).map((ph) => ({ k: PHASE_NAME[ph], econ: Math.round((bowl[ph].r / bowl[ph].b) * 60) / 10, b: bowl[ph].b, w: bowl[ph].w }))
      : null,
  };
}
