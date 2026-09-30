// Switch the auction side of the portal between leagues (SDLL look & feel
// either way). Run it, then set LEAGUE in src/lib/league.ts to match, commit and
// push (main auto-deploys).
//
//   node scripts/league-switch.mts uscl     # SDLL -> USCL (demo)
//   node scripts/league-switch.mts sdll     # back to SDLL
//
// What it does, in order, stopping on any error:
//   1. idles the current season's live lot
//   2. archives EVERY scout_players row (+ jersey_sizes, which cascade on
//      delete) into league_pool_archive under the current league, then checks
//      the archived count equals the live count
//   3. empties scout_players and loads the target league's archived rows
//   4. flips seasons.is_active
// The archive keeps each row's id, so switching back restores the exact rows
// (sales, marks-free). auction_event keeps its history; its player_id is
// nulled by the FK while that league is switched out.
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

const SEASON_OF: Record<string, RegExp> = { sdll: /Shanti Devi/i, uscl: /Urban Sports/i };
const target = process.argv[2];
if (!SEASON_OF[target]) throw new Error("usage: node scripts/league-switch.mts <sdll|uscl>");

const { data: seasons } = await sb.from("seasons").select("id, name, is_active");
const find = (lg: string) => seasons.find((s: { name: string }) => SEASON_OF[lg].test(s.name));
const active = seasons.find((s: { is_active: boolean }) => s.is_active);
const current = Object.keys(SEASON_OF).find((lg) => SEASON_OF[lg].test(active?.name ?? ""));
const targetSeason = find(target);
if (!targetSeason) throw new Error(`No season for ${target} — run scripts/uscl-setup.mts first`);
if (!current) throw new Error(`Active season "${active?.name}" isn't a known league`);
if (current === target) {
  console.log(`Already on ${target}.`);
  process.exit(0);
}

async function all(table: string, cols = "*") {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

// 1. idle the current lot
await sb.from("auction_lot")
  .update({ status: "idle", player_id: null, current_bid: null, leading_team_id: null, updated_at: new Date().toISOString() })
  .eq("season_id", active.id);

// 2. archive the live pool + jersey sizes
const live = await all("scout_players");
const jerseys = await all("jersey_sizes");
// An empty live pool means a previous run died mid-swap: the archive is the
// only good copy, so never overwrite it with nothing.
if (!live.length) throw new Error(`Live pool is empty — keeping the ${current} archive. Load it back by hand before switching.`);
await sb.from("league_pool_archive").delete().eq("league", current);
await sb.from("league_pool_archive").delete().eq("league", `${current}:jersey`);
for (let i = 0; i < live.length; i += 200) {
  const r = await sb.from("league_pool_archive").insert(live.slice(i, i + 200).map((row) => ({ league: current, id: row.id, row })));
  if (r.error) throw new Error(`archive @${i}: ${r.error.message}`);
}
for (let i = 0; i < jerseys.length; i += 200) {
  const r = await sb.from("league_pool_archive").insert(jerseys.slice(i, i + 200).map((row) => ({ league: `${current}:jersey`, id: row.player_id, row })));
  if (r.error) throw new Error(`jersey archive: ${r.error.message}`);
}
const { count: archived } = await sb.from("league_pool_archive").select("*", { count: "exact", head: true }).eq("league", current);
if (archived !== live.length) throw new Error(`Archive check failed: ${archived} archived vs ${live.length} live — nothing deleted`);
console.log(`archived ${current}: ${archived} players, ${jerseys.length} jersey rows`);

// 3. swap the pool
const incoming = (await all("league_pool_archive", "row, league")).filter((r) => r.league === target).map((r) => r.row as Record<string, unknown>);
const incomingJerseys = (await all("league_pool_archive", "row, league")).filter((r) => r.league === `${target}:jersey`).map((r) => r.row as Record<string, unknown>);
if (!incoming.length) throw new Error(`No archived pool for ${target} — nothing changed`);
{
  const r = await sb.from("scout_players").delete().not("id", "is", null);
  if (r.error) throw new Error(`clear: ${r.error.message}`);
}
for (let i = 0; i < incoming.length; i += 200) {
  const r = await sb.from("scout_players").insert(incoming.slice(i, i + 200));
  if (r.error) throw new Error(`load @${i}: ${r.error.message} — restore with: node scripts/league-switch.mts ${current} is NOT safe now; re-run this command`);
}
if (incomingJerseys.length) await sb.from("jersey_sizes").upsert(incomingJerseys);

// 4. flip the active season
await sb.from("seasons").update({ is_active: false }).eq("id", active.id);
await sb.from("seasons").update({ is_active: true }).eq("id", targetSeason.id);
const { count } = await sb.from("scout_players").select("*", { count: "exact", head: true });
console.log(`now on ${target}: "${targetSeason.name}" · pool ${count}`);
console.log(`NEXT: set LEAGUE = "${target}" in src/lib/league.ts, commit, push.`);
