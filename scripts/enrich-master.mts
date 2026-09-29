// Complete player_master from what the app already stores:
//   1. fill gaps (photo, last team, role, category, stats) on existing rows, and
//   2. ADD every SARDA S6 archive / SDLL pool player who isn't in the master yet,
//      with phone = NULL, so /register's name search can find them (e.g.
//      squad members who were never in a registration sheet).
// Rows are matched on the numeric CricHeroes player id inside the profile link
// (stable across sheets, unlike name spellings), falling back to the exact
// lower-cased name. Existing values are never overwritten.
// Needs the 2026-09-29 addendum of supabase/registration_schema.sql.
//   node scripts/enrich-master.mts
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env: Record<string, string> = {};
for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const chId = (link: string | null) =>
  link?.match(/player-profile\/(\d+)/)?.[1] ?? link?.match(/\/(\d{4,})(?:\/|$)/)?.[1] ?? null;
const nameKey = (n: string | null) => (n ?? "").toLowerCase().replace(/\s+/g, " ").trim();

const { data: teams } = await sb.from("teams").select("id, name");
const teamName = new Map<string, string>((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));

type Src = {
  full_name: string;
  photo_url: string | null;
  cricheroes_link: string | null;
  primary_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  category: string | null;
  last_team: string | null;
  season: string;
  stats: Record<string, number | string> | null;
};

function statsOf(r: Record<string, unknown>) {
  const pick: [string, string][] = [
    ["bat_matches", "matches"], ["runs", "runs"], ["highest_score", "highest"], ["bat_avg", "bat_avg"],
    ["bat_sr", "bat_sr"], ["fifties", "fifties"], ["wickets", "wickets"], ["economy", "economy"],
    ["bowl_avg", "bowl_avg"], ["catches", "catches"],
  ];
  const out: Record<string, number | string> = {};
  for (const [from, to] of pick) {
    const v = r[from];
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v);
    out[to] = Number.isFinite(n) ? Math.round(n * 100) / 100 : String(v);
  }
  return Object.keys(out).length ? out : null;
}

// Newest first: the SDLL pool, then the SARDA archive.
const sources: Src[] = [];
for (const [table, season] of [["scout_players", "SDLL S2 pool"], ["sccl_s6_players", "SARDA S6"]] as const) {
  const { data, error } = await sb.from(table).select("*").limit(5000);
  if (error) throw new Error(`${table}: ${error.message}`);
  for (const r of data ?? []) {
    if (!r.full_name || r.is_rejected) continue;
    sources.push({
      full_name: r.full_name,
      photo_url: r.photo_url ?? null,
      cricheroes_link: r.cricheroes_link ?? null,
      primary_role: r.primary_role ?? null,
      batting_style: r.batting_style ?? null,
      bowling_style: r.bowling_style ?? null,
      category: r.auction_category ?? null,
      last_team: r.team_id ? teamName.get(r.team_id) ?? null : null,
      season,
      stats: statsOf(r),
    });
  }
  console.log(`${table} (${season}): ${data?.length ?? 0} rows`);
}

const { data: master, error } = await sb.from("player_master").select("*").limit(20000);
if (error) throw new Error(error.message);
const byCh = new Map<string, Record<string, unknown>>();
const byName = new Map<string, Record<string, unknown>>();
for (const m of master ?? []) {
  const id = chId(m.cricheroes_link);
  if (id) byCh.set(id, m);
  byName.set(nameKey(m.full_name), m);
}

let filled = 0;
const added: Record<string, unknown>[] = [];
const addedKeys = new Set<string>();
for (const s of sources) {
  const id = chId(s.cricheroes_link);
  const m = (id && byCh.get(id)) || byName.get(nameKey(s.full_name));
  if (m) {
    const patch: Record<string, unknown> = {};
    for (const k of ["photo_url", "primary_role", "batting_style", "bowling_style", "category", "last_team", "stats"] as const) {
      if (!m[k] && s[k]) patch[k] = s[k];
    }
    if (!m.cricheroes_link && s.cricheroes_link) patch.cricheroes_link = s.cricheroes_link;
    const seasons = (m.seasons as string[]) ?? [];
    if (!seasons.includes(s.season)) patch.seasons = [...seasons, s.season];
    if (Object.keys(patch).length) {
      Object.assign(m, patch);
      const { error: e } = await sb.from("player_master").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", m.id);
      if (e) throw new Error(e.message);
      filled++;
    }
    continue;
  }
  const key = id ?? `name:${nameKey(s.full_name)}`;
  if (addedKeys.has(key)) continue;
  addedKeys.add(key);
  added.push({
    phone: null,
    full_name: s.full_name,
    photo_url: s.photo_url,
    cricheroes_link: s.cricheroes_link,
    primary_role: s.primary_role,
    batting_style: s.batting_style,
    bowling_style: s.bowling_style,
    category: s.category,
    last_team: s.last_team,
    last_season: s.season,
    seasons: [s.season],
    stats: s.stats,
    source: "app archive",
  });
}

for (let i = 0; i < added.length; i += 200) {
  const { error: e } = await sb.from("player_master").insert(added.slice(i, i + 200));
  if (e) throw new Error(`insert @${i}: ${e.message}`);
}
const { count } = await sb.from("player_master").select("*", { count: "exact", head: true });
console.log(`updated ${filled} existing · added ${added.length} without a phone · master now ${count}`);
