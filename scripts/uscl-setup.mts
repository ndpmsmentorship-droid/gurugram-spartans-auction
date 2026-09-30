// Stage USCL Season 2 inside the SDLL portal (SDLL look, USCL data) WITHOUT
// switching to it. Idempotent: re-run any time before the switch.
//
//   1. season "Urban Sports Champions League — Season 2" (inactive until
//      scripts/league-switch.mts flips it)
//   2. its 14 franchises, division "USCL", ₹3,00,000 purse each
//      (₹1,75,000 + ₹1,25,000 top-up)
//   3. auction_rules from the USCL "Owners & Retention Rules" deck
//   4. the pool — built from the franchise-portal card dump — plus Gurugram
//      Spartans' 5 owner/retention players, stored in league_pool_archive
//      (league "uscl"). league-switch.mts loads it into scout_players.
//   5. a Gurugram Spartans owner login (username gurugramspartans), password
//      printed once — only if the team has no owner yet.
//
// USCL "Legend" is stored as auction_category "Special" (the portal's top-tier
// slot, already treated as Legend by the console) and shown as "Legend" while
// USCL is the active league (src/lib/league.ts).
//
//   node scripts/uscl-setup.mts <cards.json>
import * as fs from "node:fs";
import * as path from "node:path";
import { randomInt, randomUUID } from "node:crypto";
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

export const USCL_SEASON = "Urban Sports Champions League — Season 2";
const PURSE = 300000;
const TEAMS = [
  "Bengal Tigers", "Chennai Thalaiva", "Delhi Devil", "Doon Druks", "Dubai Vipers", "Gurugram Spartans",
  "Haryana Bulls", "J&K Brocode", "Japani Tsunami", "Lucknow Lagers", "Mirzapur Officer Choice",
  "Punjab Royals", "Royal Challengers Gurgaon", "Texas Gladiatorz",
];
// Gurugram Spartans' squad before the auction (USCL franchise portal, 1 Oct).
const SPARTANS = [
  { name: "Kanishk Sheel", cat: "Special", price: 3000, acquired: "owner" },
  { name: "Kuldeep Negi", cat: "A+", price: 25000, acquired: "retained" },
  { name: "Gaurav Verma", cat: "B", price: 3000, acquired: "owner" },
  { name: "Nikhil Dhingra", cat: "B", price: 6000, acquired: "retained" },
  { name: "Prateek Suneja", cat: "A", price: 10000, acquired: "owner" },
];

const cardsFile = process.argv[2];
if (!cardsFile) throw new Error("usage: node scripts/uscl-setup.mts <cards.json>");

// ---- 1. season ------------------------------------------------------------
let { data: season } = await sb.from("seasons").select("id, is_active").eq("name", USCL_SEASON).maybeSingle();
if (!season) {
  const r = await sb.from("seasons").insert({ name: USCL_SEASON, is_active: false }).select("id, is_active").single();
  if (r.error) throw new Error(r.error.message);
  season = r.data;
}
const seasonId = season.id as string;
console.log("season", seasonId, season.is_active ? "(ACTIVE)" : "(staged)");

// ---- 2. teams -------------------------------------------------------------
const { data: have } = await sb.from("teams").select("id, name").eq("season_id", seasonId);
const teamId = new Map<string, string>((have ?? []).map((t: { id: string; name: string }) => [t.name, t.id]));
for (const name of TEAMS) {
  if (teamId.has(name)) {
    await sb.from("teams").update({ purse_total: PURSE, purse_max: PURSE, division: "USCL" }).eq("id", teamId.get(name));
    continue;
  }
  const r = await sb.from("teams")
    .insert({ season_id: seasonId, name, division: "USCL", purse_total: PURSE, purse_remaining: PURSE, purse_max: PURSE, is_mock: false })
    .select("id").single();
  if (r.error) throw new Error(`${name}: ${r.error.message}`);
  teamId.set(name, r.data.id);
}
console.log("teams", teamId.size);

// ---- 3. rules (Owners & Retention Rules deck) -----------------------------
// Bases = the deck's owner prices (A+ 20K, A 10K, B/Legend 3K). Caps are the
// widest the deck allows (A+ 2, A 6, Legend 1); the A-cap-depends-on-A+ rule
// is shown to owners by the squad planner rather than enforced in the DB.
const rules = {
  season_id: seasonId, squad_min: 13, squad_max: 22, max_bid: PURSE, min_increment: 1000,
  base_a_plus: 20000, base_a: 10000, base_b: 3000, base_special: 3000,
  cap_a_plus: 2, cap_a: 6, cap_b: 22, cap_special: 1,
};
{
  const r = await sb.from("auction_rules").upsert(rules, { onConflict: "season_id" });
  if (r.error) throw new Error(`rules: ${r.error.message}`);
}

// ---- 4. pool --------------------------------------------------------------
const BAT: Record<string, string> = { "Left Hand Batsman": "Left-hand bat", "Right Hand Batsman": "Right-hand bat" };
const BOWL: Record<string, string> = {
  "Left Arm Pacer": "Left-arm medium", "Left Arm Spinner": "Left-arm orthodox",
  "Right Arm Pacer": "Right-arm medium", "Right Arm Spin": "Right-arm off-break",
};
const chId = (l: string | null | undefined) => l?.match(/player-profile\/(\d+)/)?.[1] ?? null;
const nameKey = (n: string | null | undefined) => (n ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const num = (v: string | undefined) => (v && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : null);

const { data: master } = await sb.from("player_master").select("full_name, photo_url, cricheroes_link, primary_role, batting_style, bowling_style, stats").limit(20000);
const mByCh = new Map<string, Record<string, unknown>>();
const mByName = new Map<string, Record<string, unknown>>();
for (const m of master ?? []) {
  const id = chId(m.cricheroes_link);
  if (id && !mByCh.has(id)) mByCh.set(id, m);
  if (!mByName.has(nameKey(m.full_name))) mByName.set(nameKey(m.full_name), m);
}
const goodPhoto = (u: unknown) => typeof u === "string" && !/\.pdf($|\?)|cricheroes_fb_cover|jsdelivr/.test(u) ? u : null;

type Card = { text: string; ch: string | null; img: string | null };
const cards = JSON.parse(fs.readFileSync(cardsFile, "utf8")) as Card[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rows: any[] = [];
const seen = new Set<string>();
for (const c of cards) {
  const lines = c.text.split("\n").map((s) => s.trim()).filter(Boolean);
  const name = lines[0].replace(/\s+/g, " ");
  const catLine = lines.find((l) => /^(CATEGORY|LEGEND)/.test(l)) ?? "";
  const cat = catLine === "LEGEND" ? "Special" : catLine.replace("CATEGORY ", "") || null;
  const age = Number(lines.find((l) => /^\d+ YRS$/.test(l))?.split(" ")[0]) || null;
  const stop = lines.indexOf("Wishlist");
  const tags = lines.slice(1, stop > 0 ? stop : undefined).filter((l) => l !== catLine && !/YRS$/.test(l));
  const stat = (k: string) => num(lines.find((l) => l.startsWith(k + " "))?.slice(k.length + 1));
  const bat = tags.find((t) => BAT[t]);
  const bowl = tags.find((t) => BOWL[t]);
  const keeper = tags.some((t) => /Keeper/.test(t));
  const allround = tags.some((t) => /All Rounder/.test(t));
  const m = (chId(c.ch) && mByCh.get(chId(c.ch)!)) || mByName.get(nameKey(name));
  const matches = stat("M"), wickets = stat("Wkts"), bowlSr = stat("Bowl SR");
  let econ = stat("Econ");
  if (econ != null && econ > 15) econ = null;
  const overs = wickets != null && bowlSr != null ? Math.round(((wickets * bowlSr) / 6) * 10) / 10 : null;
  const key = chId(c.ch) ?? `n:${nameKey(name)}:${age}`;
  if (seen.has(key)) continue;
  seen.add(key);
  rows.push({
    id: randomUUID(),
    source_id: `uscl:${key}`,
    full_name: name,
    age,
    primary_role: allround ? "All-Rounder" : keeper ? "Wicket-Keeper" : bowl && !bat ? "Bowler" : "Batsman",
    photo_url: goodPhoto(m?.photo_url),
    cricheroes_link: c.ch,
    batting_style: bat ? BAT[bat] : null,
    bowling_style: bowl ? BOWL[bowl] : null,
    is_keeper: keeper,
    auction_category: cat,
    scout_category: cat === "Special" ? "Legend" : cat,
    reg_status: "verified",
    is_rejected: false,
    is_bought: false,
    is_marquee: false,
    bat_matches: matches,
    bat_innings: matches,
    runs: stat("Runs"),
    bat_avg: stat("Avg"),
    bat_sr: stat("SR"),
    bowl_matches: wickets ? matches : null,
    wickets,
    bowl_sr: bowlSr,
    economy: econ,
    overs,
    bowl_runs: overs != null && econ != null ? Math.round(overs * econ) : null,
    team_id: null,
    sold_price: null,
    acquired: null,
  });
}

// Gurugram Spartans' existing 5 (owners + retentions), from our player master.
for (const s of SPARTANS) {
  const m = mByName.get(nameKey(s.name));
  const st = ((m?.stats ?? {}) as Record<string, number>);
  const role = String(m?.primary_role ?? "");
  rows.push({
    id: randomUUID(),
    source_id: `uscl:spartans:${nameKey(s.name)}`,
    full_name: s.name,
    age: null,
    primary_role: /keep/i.test(role) ? "Wicket-Keeper" : /all/i.test(role) ? "All-Rounder" : /bowl/i.test(role) ? "Bowler" : "Batsman",
    photo_url: goodPhoto(m?.photo_url),
    cricheroes_link: (m?.cricheroes_link as string) ?? null,
    batting_style: (m?.batting_style as string) ?? null,
    bowling_style: (m?.bowling_style as string) ?? null,
    is_keeper: /keep/i.test(role),
    auction_category: s.cat,
    scout_category: s.cat === "Special" ? "Legend" : s.cat,
    reg_status: "verified",
    is_rejected: false,
    is_bought: true,
    is_marquee: false,
    bat_matches: st.matches ?? null,
    bat_innings: st.matches ?? null,
    runs: st.runs ?? null,
    bat_avg: st.bat_avg ?? null,
    bat_sr: st.bat_sr ?? null,
    wickets: st.wickets ?? null,
    economy: st.economy ?? null,
    team_id: teamId.get("Gurugram Spartans"),
    sold_price: s.price,
    acquired: s.acquired,
  });
}

// Rankings across the USCL pool only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const idx = computeIndices(rows.map((r: any) => ({ ...r, not_out: null, fifties: null, hundreds: null, fours: null, sixes: null, dot_balls: null, bowl_fours: null, bowl_sixes: null, five_w: null, catches: null, run_outs: null, stumpings: null, keeping_catches: null })));
rows.forEach((r, i) => Object.assign(r, idx[i]));

await sb.from("league_pool_archive").delete().eq("league", "uscl");
for (let i = 0; i < rows.length; i += 100) {
  const r = await sb.from("league_pool_archive").insert(rows.slice(i, i + 100).map((row) => ({ league: "uscl", id: row.id, row })));
  if (r.error) throw new Error(`archive @${i}: ${r.error.message}`);
}
console.log(`pool staged: ${rows.length} rows (${rows.length - SPARTANS.length} available + ${SPARTANS.length} Spartans)`);

// ---- 5. Gurugram Spartans owner login -------------------------------------
const spartansId = teamId.get("Gurugram Spartans")!;
const { data: sp } = await sb.from("teams").select("owner_profile_id").eq("id", spartansId).single();
if (!sp.owner_profile_id) {
  const username = "gurugramspartans";
  const email = `${username}@owners.sdll`;
  const words = ["Cover", "Drive", "Yorker", "Sixer", "Googly", "Bouncer", "Century", "Spinner"];
  const password = `${words[randomInt(8)]}-${words[randomInt(8)]}-${randomInt(1000, 9999)}`;
  const list = await sb.auth.admin.listUsers({ perPage: 1000 });
  let uid = list.data.users.find((u: { email: string }) => u.email === email)?.id;
  if (!uid) {
    const c = await sb.auth.admin.createUser({ email, password, email_confirm: true });
    if (c.error) throw new Error(c.error.message);
    uid = c.data.user.id;
    await new Promise((r) => setTimeout(r, 800));
    console.log(`OWNER LOGIN (shown once): ${username} / ${password}`);
  }
  await sb.from("profiles").upsert({ id: uid, display_name: "Gurugram Spartans", role: "owner" });
  await sb.from("teams").update({ owner_profile_id: uid }).eq("id", spartansId);
}
console.log("done");
