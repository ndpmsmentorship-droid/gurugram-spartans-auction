// Reconcile our live USCL pool + squads with the OFFICIAL USCL website.
//
//   U=… P=… python scripts/uscl-fetch.py /tmp/official.json      # read-only pull
//   node scripts/uscl-reconcile.mts /tmp/official.json              # report only
//   node scripts/uscl-reconcile.mts /tmp/official.json --apply      # fix what is safe
//   … --apply --hide-gone                                           # pre-auction only
//
// The website is the source of truth. What it gives us:
//   pool   — the franchise portal's pool export = players STILL AVAILABLE
//   squad  — Gurugram Spartans' "My Squad" (names, category, price, type)
//   public — /franchises: names listed under each team
// It does not say who bought a player, so a player who drops out of the pool is
// reported ("sold or withdrawn on USCL — record it on the pad"), never guessed.
//
// --apply: adds players new to the pool, un-hides players we'd hidden who are
// listed again, applies category changes, and makes OUR squad match My Squad.
// --hide-gone: also hides unsold players missing from the pool (withdrawals) —
// before the auction only; during it, missing = sold.
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { computeIndices } from "../src/lib/scout/rankings.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env: Record<string, string> = {};
for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const HIDE_GONE = process.argv.includes("--hide-gone");
const file = process.argv[2];
if (!file || file.startsWith("--")) throw new Error("usage: node scripts/uscl-reconcile.mts <official.json> [--apply] [--hide-gone]");
const official = JSON.parse(fs.readFileSync(file, "utf8")) as {
  fetched_at: string;
  pool: Record<string, string | number | null>[];
  squad: { name: string; category: string; price: number; type: string }[];
  public: Record<string, string[]>;
};

const nz = (s: unknown) => String(s ?? "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
const cat = (s: unknown) => {
  const t = String(s ?? "").toUpperCase().replace("CATEGORY ", "").trim();
  return t === "LEGEND" ? "Special" : ["A+", "A", "B"].includes(t) ? t : null;
};
const numOr = (v: unknown) => (v != null && /^\d+(\.\d+)?$/.test(String(v).trim()) ? Number(v) : null);

async function all(table: string, cols: string) {
  const out: Record<string, any>[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (let f = 0; ; f += 1000) {
    const r = await sb.from(table).select(cols).range(f, f + 999);
    if (r.error) throw new Error(`${table}: ${r.error.message}`);
    out.push(...r.data);
    if (r.data.length < 1000) return out;
  }
}

const { data: season } = await sb.from("seasons").select("id, is_active").ilike("name", "Urban Sports%").single();
if (!season?.is_active) throw new Error("USCL isn't the active season.");
const { data: teams } = await sb.from("teams").select("id, name").eq("season_id", season.id);
const teamName = new Map<string, string>(teams.map((t: { id: string; name: string }) => [t.id, t.name]));
const spartans = teams.find((t: { name: string }) => t.name === "Gurugram Spartans").id as string;
const pool = await all("scout_players", "*");
const byName = new Map<string, Record<string, any>[]>(); // eslint-disable-line @typescript-eslint/no-explicit-any
for (const p of pool) byName.set(nz(p.full_name), [...(byName.get(nz(p.full_name)) ?? []), p]);

// ---- A. pool -------------------------------------------------------------------
const listed = new Set(official.pool.map((r) => nz(r.Player)));
const listedCount = new Map<string, number>();
for (const r of official.pool) listedCount.set(nz(r.Player), (listedCount.get(nz(r.Player)) ?? 0) + 1);
const ambiguous: string[] = [];
const newRows: Record<string, unknown>[] = [];
const unhide: Record<string, any>[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
const catFix: { p: Record<string, any>; to: string }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
const soldHereListedThere: string[] = [];
for (const r of official.pool) {
  const mine = byName.get(nz(r.Player)) ?? [];
  const c = cat(r.Category);
  if (!mine.length) {
    const roles = String(r.Roles ?? "");
    const wk = /Keeper/.test(roles), ar = /All Rounder/.test(roles), bowl = /Pacer|Spin/.test(roles), bat = /Batsman/.test(roles);
    const wkts = numOr(r.Wickets), bsr = numOr(r["Bowling SR"]);
    let econ = numOr(r.Economy);
    if (econ != null && econ > 15) econ = null;
    const overs = wkts != null && bsr != null ? Math.round(((wkts * bsr) / 6) * 10) / 10 : null;
    newRows.push({
      id: randomUUID(), source_id: `uscl:x:${nz(r.Player).replace(/ /g, "-")}:${r.Age ?? ""}`,
      full_name: String(r.Player).trim(), age: numOr(r.Age),
      primary_role: ar ? "All-Rounder" : wk ? "Wicket-Keeper" : bowl && !bat ? "Bowler" : "Batsman",
      cricheroes_link: r.CricHeroes ?? null,
      batting_style: /Left Hand/.test(roles) ? "Left-hand bat" : /Right Hand/.test(roles) ? "Right-hand bat" : null,
      bowling_style: /Left Arm Pacer/.test(roles) ? "Left-arm medium" : /Left Arm Spin/.test(roles) ? "Left-arm orthodox" : /Right Arm Pacer/.test(roles) ? "Right-arm medium" : /Right Arm Spin/.test(roles) ? "Right-arm off-break" : null,
      is_keeper: wk, auction_category: c, scout_category: c === "Special" ? "Legend" : c,
      reg_status: "verified", is_rejected: false, is_bought: false, is_marquee: false,
      bat_matches: numOr(r["Matches Played"]), bat_innings: numOr(r["Matches Played"]), runs: numOr(r["Runs Scored"]),
      bat_avg: numOr(r["Batting Avg"]), bat_sr: numOr(r["Batting SR"]), wickets: wkts, bowl_sr: bsr, economy: econ, overs,
      bowl_runs: overs != null && econ != null ? Math.round(overs * econ) : null, team_id: null, sold_price: null, acquired: null,
    });
    continue;
  }
  const free = mine.filter((p) => !p.team_id);
  if (!free.length) {
    soldHereListedThere.push(`${r.Player} (here: ${mine.map((p) => teamName.get(p.team_id)).join("/")})`);
    continue;
  }
  // Two players with one name (on either side): un-hide both, but don't guess categories.
  if (free.length > 1 || (listedCount.get(nz(r.Player)) ?? 0) > 1) {
    for (const p of free) if (p.is_rejected && !unhide.includes(p)) unhide.push(p);
    if (!ambiguous.includes(String(r.Player))) ambiguous.push(String(r.Player));
    continue;
  }
  for (const p of free) {
    if (p.is_rejected) unhide.push(p);
    if (c && p.auction_category !== c) catFix.push({ p, to: c });
  }
}
const goneUnsold = pool.filter((p) => !p.team_id && !p.is_rejected && !listed.has(nz(p.full_name)));

// ---- B. our squad vs My Squad -----------------------------------------------------
const theirs = official.squad.map((s) => ({ ...s, cat: cat(s.category), acq: /RETENTION/i.test(s.type) ? "retained" : /OWNER/i.test(s.type) ? "owner" : "auction" }));
const ours = pool.filter((p) => p.team_id === spartans);
const findOurs = (n: string) =>
  ours.find((p) => nz(p.full_name) === nz(n)) ??
  (ours.filter((p) => nz(p.full_name).split(" ")[0] === nz(n)).length === 1 ? ours.find((p) => nz(p.full_name).split(" ")[0] === nz(n)) : undefined);
const squadFix: { p: Record<string, any>; set: Record<string, unknown>; why: string }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
const squadMissing: typeof theirs = [];
for (const s of theirs) {
  const p = findOurs(s.name);
  if (!p) { squadMissing.push(s); continue; }
  const set: Record<string, unknown> = {};
  if (Number(p.sold_price) !== s.price) set.sold_price = s.price;
  if (p.acquired !== s.acq) set.acquired = s.acq;
  if (s.cat && p.auction_category !== s.cat) set.auction_category = s.cat;
  if (Object.keys(set).length) squadFix.push({ p, set, why: `${p.full_name}: ${p.acquired} ₹${p.sold_price} → ${s.acq} ₹${s.price}` });
}
const squadExtra = ours.filter((p) => !theirs.some((s) => findOurs(s.name)?.id === p.id));

// ---- C. public team lists -------------------------------------------------------------
const NAV = new Set(["home", "venue", "sponsors", "register", "franchises", "fixtures", "live scores"]);
const publicDiff: string[] = [];
for (const [T, names] of Object.entries(official.public)) {
  const t = teams.find((x: { name: string }) => x.name.toUpperCase() === T);
  if (!t) { publicDiff.push(`${T}: not a team here`); continue; }
  const roster = pool.filter((p) => p.team_id === t.id).map((p) => nz(p.full_name));
  for (const n of names) {
    if (NAV.has(n.toLowerCase())) continue;
    const k = nz(n);
    if (!roster.includes(k) && !roster.some((r) => r.split(" ")[0] === k)) publicDiff.push(`${t.name}: USCL lists "${n}" — not on our ${t.name} roster`);
  }
}

// ---- report ---------------------------------------------------------------------------
const line = (title: string, items: string[]) => console.log(`\n${title} (${items.length})${items.length ? ":\n  " + items.join("\n  ") : ": —"}`);
console.log(`USCL data fetched ${official.fetched_at} · USCL pool ${official.pool.length} · our available ${pool.filter((p) => !p.team_id && !p.is_rejected).length}`);
line("NEW on USCL → add", newRows.map((r) => `${r.full_name} (${r.auction_category})`));
line("Listed on USCL but hidden here → un-hide", unhide.map((p) => p.full_name));
line("Same name twice — check categories by hand", ambiguous);
line("Category changed", catFix.map(({ p, to }) => `${p.full_name}: ${p.auction_category} → ${to}`));
line("⚠ SOLD/assigned here but still AVAILABLE on USCL", soldHereListedThere);
line(`GONE from USCL pool, unsold here → ${HIDE_GONE ? "hide" : "sold or withdrawn on USCL — record who bought him"}`, goneUnsold.map((p) => `${p.full_name} (${p.auction_category})`));
line("Our squad: fix to match USCL My Squad", squadFix.map((f) => f.why));
line("⚠ On USCL My Squad, missing from ours", squadMissing.map((s) => `${s.name} ${s.category} ₹${s.price} ${s.type}`));
line("⚠ On our squad, not on USCL My Squad", squadExtra.map((p) => `${p.full_name} ₹${p.sold_price} ${p.acquired}`));
line("⚠ Public franchise lists vs our rosters", publicDiff);

if (!APPLY) {
  console.log("\nReport only. Re-run with --apply to fix the safe items.");
  process.exit(0);
}
for (let i = 0; i < newRows.length; i += 100) {
  const r = await sb.from("scout_players").insert(newRows.slice(i, i + 100));
  if (r.error) throw new Error(`insert: ${r.error.message}`);
}
for (const p of unhide) await sb.from("scout_players").update({ is_rejected: false }).eq("id", p.id);
for (const { p, to } of catFix) await sb.from("scout_players").update({ auction_category: to, scout_category: to === "Special" ? "Legend" : to }).eq("id", p.id);
for (const f of squadFix) await sb.from("scout_players").update(f.set).eq("id", f.p.id);
if (HIDE_GONE) for (const p of goneUnsold) await sb.from("scout_players").update({ is_rejected: true }).eq("id", p.id);
if (newRows.length || unhide.length || catFix.length || HIDE_GONE) {
  const after = (await all("scout_players", "*")).filter((p) => !p.is_rejected);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idx = computeIndices(after.map((r: any) => ({ ...r })));
  for (let i = 0; i < after.length; i += 25)
    await Promise.all(after.slice(i, i + 25).map((r, j) => sb.from("scout_players").update(idx[i + j]).eq("id", r.id)));
}
console.log("\nApplied.");
