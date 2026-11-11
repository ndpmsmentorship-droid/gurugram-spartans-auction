// Batting-order and phase numbers for the owners' planner, from the ND Cric Videos Ball Library
// (Nikhil, 12 Nov 2026: "best suggestions on each field based on ball library numbers").
//
// Source: the Ball Library's per-ball match files (LMS repo public/spartans/shots/*.json): every
// ball carries over, bowler, striker, runs, wicket and extra type. Per innings, a batter's position
// is the order in which he first faced a ball (a batter out without facing is not counted).
//   Phases: powerplay overs 1–6, middle 7–15, death 16–20.
//   Batter: runs off the bat (not byes / leg-byes / wides), balls faced (not wides), outs.
//   Bowler: legal balls (not wides / no-balls), runs conceded (not byes / leg-byes), wickets
//           (every wicket on his ball — the files don't say which were run-outs).
//
// Writes src/data/role-stats.json: { source, matches, players: { libraryName: { bat, bowl } } }
// Pool names reach these through src/data/cv-map.json (scripts/build-cv-map.py).
//
//   node scripts/build-role-stats.mjs ~/Claude/strategies/ycwism-lms-src/public/spartans/shots
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.argv[2];
if (!dir) throw new Error("usage: node scripts/build-role-stats.mjs <ball library shots dir>");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const phaseOf = (o) => {
  const over = Math.floor(Number(String(o).split(".")[0])) + 1; // "5.3" is the 6th over
  return over <= 6 ? "pp" : over <= 15 ? "mid" : "death";
};
const band = (pos) => (pos <= 3 ? "top" : pos <= 6 ? "upper" : pos <= 9 ? "lower" : "tail");
const blankBat = () => ({ inns: 0, pos: { top: 0, upper: 0, lower: 0, tail: 0 }, pp: { r: 0, b: 0, out: 0 }, mid: { r: 0, b: 0, out: 0 }, death: { r: 0, b: 0, out: 0 } });
const blankBowl = () => ({ pp: { b: 0, r: 0, w: 0 }, mid: { b: 0, r: 0, w: 0 }, death: { b: 0, r: 0, w: 0 } });

const players = {};
const get = (n) => (players[n] ??= { bat: blankBat(), bowl: blankBowl() });
let matches = 0;

for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json").sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const balls = Array.isArray(d.balls) ? d.balls : [];
  if (balls.length < 60) continue; // a stub, not a match
  matches++;
  const order = { 1: [], 2: [] };
  for (const b of balls) {
    if (!b?.o || !/^\d+\.\d$/.test(String(b.o))) continue;
    const ph = phaseOf(b.o);
    const x = b.x ?? null;
    const r = Number(b.r) || 0;
    if (b.striker) {
      const seen = order[b.inns] ?? (order[b.inns] = []);
      if (!seen.includes(b.striker)) seen.push(b.striker);
      const s = get(b.striker).bat[ph];
      if (x !== "wd") s.b++;
      if (x === null || x === "nb") s.r += x === "nb" ? Math.max(0, r - 1) : r;
      if (b.w) s.out++;
    }
    if (b.bowler) {
      const s = get(b.bowler).bowl[ph];
      if (x !== "wd" && x !== "nb") s.b++;
      if (x !== "b" && x !== "lb") s.r += r;
      if (b.w) s.w++;
    }
  }
  for (const seen of Object.values(order))
    seen.forEach((name, i) => {
      const bt = get(name).bat;
      bt.inns++;
      bt.pos[band(i + 1)]++;
    });
}

// drop empty halves to keep the bundle small
for (const [n, p] of Object.entries(players)) {
  if (!p.bat.inns) delete p.bat;
  if (!p.bowl.pp.b && !p.bowl.mid.b && !p.bowl.death.b) delete p.bowl;
  if (!p.bat && !p.bowl) delete players[n];
}
const out = { source: "ND Cric Videos Ball Library — per-ball logs", matches, built: new Date().toISOString().slice(0, 10), players };
fs.writeFileSync(path.join(ROOT, "src/data/role-stats.json"), JSON.stringify(out));
console.log(`${matches} matches · ${Object.keys(players).length} players → src/data/role-stats.json`);
