// Re-sync the LIVE USCL pool (league switched in) with the organisers' latest data.
//
//   node scripts/uscl-sync.mts <cards.json>            # dry run: prints the plan
//   node scripts/uscl-sync.mts <cards.json> --apply    # writes it
//
// <cards.json> = a fresh scrape of the USCL franchise portal's player pool
// (same shape uscl-setup.mts takes). scripts/data/uscl-pre-auction.json = the
// official "Franchise Owners & Retentions" deck.
//
// 1. Pool: new portal players are added; players gone from the portal (and not on
//    a team) are hidden with is_rejected; category changes are applied.
// 2. Teams: every owner / retained / legend in the deck is put on his franchise at
//    the deck price (owner A+ 20K · A 10K · B/Legend 3K; retained A+ 25K · A 15K ·
//    B 6K · Legend 3K). Previous owner/retained assignments are cleared first, so
//    the deck is the single source of truth. Auction sales are never touched.
//    A deck player who isn't in the pool is added from player_master.
// 3. Indices are recomputed across the pool.
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
const cardsFile = process.argv[2];
if (!cardsFile || cardsFile.startsWith("--")) throw new Error("usage: node scripts/uscl-sync.mts <cards.json> [--apply]");

const OWNER_PRICE: Record<string, number> = { "A+": 20000, A: 10000, B: 3000, Special: 3000 };
const RETAIN_PRICE: Record<string, number> = { "A+": 25000, A: 15000, B: 6000, Special: 3000 };

const nz = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
const chId = (l: string | null | undefined) => l?.match(/player-profile\/(\d+)/)?.[1] ?? null;
const num = (v: string | undefined) => (v && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : null);
const BAT: Record<string, string> = { "Left Hand Batsman": "Left-hand bat", "Right Hand Batsman": "Right-hand bat" };
const BOWL: Record<string, string> = {
  "Left Arm Pacer": "Left-arm medium", "Left Arm Spinner": "Left-arm orthodox",
  "Right Arm Pacer": "Right-arm medium", "Right Arm Spin": "Right-arm off-break",
};
const goodPhoto = (u: unknown) => (typeof u === "string" && !/\.pdf($|\?)|cricheroes_fb_cover|jsdelivr/.test(u) ? u : null);

async function all(table: string, cols: string) {
  const out: Record<string, any>[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (let f = 0; ; f += 1000) {
    const r = await sb.from(table).select(cols).range(f, f + 999);
    if (r.error) throw new Error(`${table}: ${r.error.message}`);
    out.push(...r.data);
    if (r.data.length < 1000) return out;
  }
}

// ---- context -----------------------------------------------------------------
const { data: season } = await sb.from("seasons").select("id, is_active").ilike("name", "Urban Sports%").single();
if (!season?.is_active) throw new Error("USCL isn't the active season — this script edits the LIVE pool only.");
const { data: teams } = await sb.from("teams").select("id, name").eq("season_id", season.id);
const teamId = new Map<string, string>(teams.map((t: { id: string; name: string }) => [t.name, t.id]));
const pool = await all("scout_players", "*");
const master = await all("player_master", "full_name, photo_url, cricheroes_link, primary_role, batting_style, bowling_style, stats");
const mByName = new Map(master.map((m) => [nz(m.full_name), m]));
const mByCh = new Map(master.filter((m) => chId(m.cricheroes_link)).map((m) => [chId(m.cricheroes_link)!, m]));

// ---- 1. portal cards -> rows ---------------------------------------------------
type Card = { text: string; ch: string | null };
const cards = JSON.parse(fs.readFileSync(cardsFile, "utf8")) as Card[];
const fresh = new Map<string, Record<string, unknown>>();
for (const c of cards) {
  const lines = c.text.split("\n").map((s) => s.trim()).filter(Boolean);
  const name = lines[0].replace(/\s+/g, " ");
  const catLine = lines.find((l) => /^(CATEGORY|LEGEND)/.test(l)) ?? "";
  const cat = catLine === "LEGEND" ? "Special" : catLine.replace("CATEGORY ", "") || null;
  if (cat && !["A+", "A", "B", "Special"].includes(cat)) continue;
  const age = Number(lines.find((l) => /^\d+ YRS$/.test(l))?.split(" ")[0]) || null;
  const stop = lines.indexOf("Wishlist");
  const tags = lines.slice(1, stop > 0 ? stop : undefined).filter((l) => l !== catLine && !/YRS$/.test(l));
  const stat = (k: string) => num(lines.find((l) => l.startsWith(k + " "))?.slice(k.length + 1));
  const bat = tags.find((t) => BAT[t]);
  const bowl = tags.find((t) => BOWL[t]);
  const keeper = tags.some((t) => /Keeper/.test(t));
  const allround = tags.some((t) => /All Rounder/.test(t));
  const m = (chId(c.ch) && mByCh.get(chId(c.ch)!)) || mByName.get(nz(name));
  const matches = stat("M"), wickets = stat("Wkts"), bowlSr = stat("Bowl SR");
  let econ = stat("Econ");
  if (econ != null && econ > 15) econ = null;
  const overs = wickets != null && bowlSr != null ? Math.round(((wickets * bowlSr) / 6) * 10) / 10 : null;
  const key = `uscl:${chId(c.ch) ?? `n:${nz(name)}:${age}`}`;
  fresh.set(key, {
    source_id: key, full_name: name, age,
    primary_role: allround ? "All-Rounder" : keeper ? "Wicket-Keeper" : bowl && !bat ? "Bowler" : "Batsman",
    photo_url: goodPhoto(m?.photo_url), cricheroes_link: c.ch,
    batting_style: bat ? BAT[bat] : null, bowling_style: bowl ? BOWL[bowl] : null, is_keeper: keeper,
    auction_category: cat, scout_category: cat === "Special" ? "Legend" : cat,
    bat_matches: matches, bat_innings: matches, runs: stat("Runs"), bat_avg: stat("Avg"), bat_sr: stat("SR"),
    bowl_matches: wickets ? matches : null, wickets, bowl_sr: bowlSr, economy: econ, overs,
    bowl_runs: overs != null && econ != null ? Math.round(overs * econ) : null,
  });
}

const bySource = new Map(pool.map((p) => [p.source_id as string, p]));
const inserts: Record<string, unknown>[] = [];
const updates: { id: string; patch: Record<string, unknown>; why: string }[] = [];
for (const [key, row] of fresh) {
  const cur = bySource.get(key);
  if (!cur) {
    inserts.push({ id: randomUUID(), ...row, reg_status: "verified", is_rejected: false, is_bought: false, is_marquee: false, team_id: null, sold_price: null, acquired: null });
    continue;
  }
  const patch: Record<string, unknown> = {};
  if (cur.auction_category !== row.auction_category) patch.auction_category = row.auction_category, patch.scout_category = row.scout_category;
  if (cur.is_rejected) patch.is_rejected = false;
  if (Object.keys(patch).length) updates.push({ id: cur.id, patch, why: `${cur.full_name}: ${cur.auction_category}→${row.auction_category}${cur.is_rejected ? " (back in pool)" : ""}` });
}
const gone = pool.filter((p) => String(p.source_id).startsWith("uscl:") && !String(p.source_id).startsWith("uscl:pre:") && !String(p.source_id).startsWith("uscl:spartans:") && !fresh.has(p.source_id) && !p.is_rejected);

// ---- 2. deck ---------------------------------------------------------------------
const deck = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/data/uscl-pre-auction.json"), "utf8")) as Record<string, [string, string, string][]>;
const freshNames = new Set([...fresh.values()].map((r) => nz(r.full_name as string)));
const assigned = new Set<string>();
const plan: { team: string; name: string; cat: string; kind: string; price: number; id: string | null; note: string }[] = [];
for (const [team, people] of Object.entries(deck)) {
  if (team.startsWith("_")) continue;
  if (!teamId.has(team)) throw new Error(`Unknown team in deck: ${team}`);
  for (const [name, cat, k] of people) {
    const acquired = k === "r" || k === "l" ? "retained" : "owner";
    const price = (acquired === "owner" ? OWNER_PRICE : RETAIN_PRICE)[cat];
    // Candidates by name. A player still listed in the portal's AVAILABLE pool is a
    // different person (the portal removes owners/retentions), so skip those.
    const cands = pool.filter((p) => nz(p.full_name) === nz(name) && !assigned.has(p.id));
    const onTeamAlready = cands.filter((p) => p.team_id === teamId.get(team));
    const notAvailable = cands.filter((p) => !fresh.has(p.source_id));
    const pick = onTeamAlready[0] ?? (notAvailable.length === 1 ? notAvailable[0] : null);
    if (pick) assigned.add(pick.id);
    const note = pick ? (pick.team_id && pick.team_id !== teamId.get(team) ? "MOVED from another team" : "") :
      freshNames.has(nz(name)) ? "namesake in pool kept available; added as new row" : notAvailable.length > 1 ? "AMBIGUOUS — added as new row" : "new row";
    plan.push({ team, name, cat, kind: acquired, price, id: pick?.id ?? null, note });
  }
}
const preIds = new Set(plan.map((p) => p.id).filter(Boolean));
const clear = pool.filter((p) => (p.acquired === "owner" || p.acquired === "retained") && !preIds.has(p.id));

// ---- report ------------------------------------------------------------------------
console.log(`pool ${pool.length} · portal ${fresh.size}`);
console.log(`\nNEW in portal (${inserts.length}):`, inserts.map((r) => `${r.full_name} (${r.auction_category})`).join(", ") || "—");
console.log(`\nGONE from portal, hidden (${gone.length}):`, gone.map((p) => p.full_name).join(", ") || "—");
console.log(`\nCHANGED (${updates.length}):`, updates.map((u) => u.why).join(", ") || "—");
console.log(`\nCLEARED old owner/retained (${clear.length}):`, clear.map((p) => p.full_name).join(", ") || "—");
console.log(`\nDECK (${plan.length}):`);
for (const p of plan) console.log(`  ${p.team.padEnd(26)} ${p.name.padEnd(22)} ${p.cat.padEnd(7)} ${p.kind.padEnd(8)} ₹${p.price}  ${p.id ? "" : "+"}${p.note}`);
const spend = new Map<string, number>();
for (const p of plan) spend.set(p.team, (spend.get(p.team) ?? 0) + p.price);
console.log("\nPre-auction spend:", [...spend].map(([t, s]) => `${t} ₹${s}`).join(" · "));
if (!APPLY) {
  console.log("\nDry run — nothing written. Re-run with --apply.");
  process.exit(0);
}

// ---- apply -------------------------------------------------------------------------
const lot = await sb.from("auction_lot").select("status").eq("season_id", season.id).maybeSingle();
if (lot.data?.status === "live") throw new Error("A lot is live — run this between lots.");
for (let i = 0; i < inserts.length; i += 100) {
  const r = await sb.from("scout_players").insert(inserts.slice(i, i + 100));
  if (r.error) throw new Error(`insert: ${r.error.message}`);
}
for (const u of updates) await sb.from("scout_players").update(u.patch).eq("id", u.id);
for (const p of gone) if (!p.team_id) await sb.from("scout_players").update({ is_rejected: true }).eq("id", p.id);
for (const p of clear) await sb.from("scout_players").update({ team_id: null, sold_price: null, acquired: null }).eq("id", p.id);
for (const p of plan) {
  const set = { team_id: teamId.get(p.team), sold_price: p.price, acquired: p.kind, auction_category: p.cat, scout_category: p.cat === "Special" ? "Legend" : p.cat, is_rejected: false };
  if (p.id) {
    const r = await sb.from("scout_players").update(set).eq("id", p.id);
    if (r.error) throw new Error(`${p.name}: ${r.error.message}`);
    continue;
  }
  const m = mByName.get(nz(p.name));
  const st = (m?.stats ?? {}) as Record<string, number>;
  const role = String(m?.primary_role ?? "");
  const r = await sb.from("scout_players").insert({
    id: randomUUID(), source_id: `uscl:pre:${nz(p.name).replace(/ /g, "-")}:${teamId.get(p.team)!.slice(0, 8)}`,
    full_name: p.name.replace(/\s*\(.*?\)\s*/g, " ").trim(), age: null,
    primary_role: /keep/i.test(role) ? "Wicket-Keeper" : /all/i.test(role) ? "All-Rounder" : /bowl/i.test(role) ? "Bowler" : "Batsman",
    photo_url: goodPhoto(m?.photo_url), cricheroes_link: (m?.cricheroes_link as string) ?? null,
    batting_style: (m?.batting_style as string) ?? null, bowling_style: (m?.bowling_style as string) ?? null,
    is_keeper: /keep/i.test(role), reg_status: "verified", is_bought: true, is_marquee: false,
    bat_matches: st.matches ?? null, bat_innings: st.matches ?? null, runs: st.runs ?? null, bat_avg: st.bat_avg ?? null,
    bat_sr: st.bat_sr ?? null, wickets: st.wickets ?? null, economy: st.economy ?? null, ...set,
  });
  if (r.error) throw new Error(`${p.name}: ${r.error.message}`);
}

// indices across the (visible) pool
const after = (await all("scout_players", "*")).filter((p) => !p.is_rejected);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const idx = computeIndices(after.map((r: any) => ({ ...r })));
for (let i = 0; i < after.length; i += 25)
  await Promise.all(after.slice(i, i + 25).map((r, j) => sb.from("scout_players").update(idx[i + j]).eq("id", r.id)));
console.log(`\nApplied. Visible pool ${after.length}.`);
