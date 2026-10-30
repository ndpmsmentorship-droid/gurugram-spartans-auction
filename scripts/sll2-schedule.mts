// SLL-2 fixtures as in the partnership proposal: 14 teams, two groups of seven,
// 45 matches from Sat 16 Jan to Sun 7 Mar 2027 (DEFAULT_CONFIG in
// src/lib/schedule/generate.ts). Replaces the active season's fixtures, the
// same as Admin → Schedule → Generate.
//
//   node scripts/sll2-schedule.mts           # dry run
//   node scripts/sll2-schedule.mts --apply
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { generateSchedule, DEFAULT_CONFIG } from "../src/lib/schedule/generate.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env: Record<string, string> = {};
for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }); // eslint-disable-line @typescript-eslint/no-explicit-any
const APPLY = process.argv.includes("--apply");

const { data: season } = await sb.from("seasons").select("id, name").eq("is_active", true).single();
const { data: teams } = await sb.from("teams").select("id, name, division, is_mock").eq("season_id", season.id).order("name");
const mock = teams.filter((t: { is_mock: boolean }) => t.is_mock);
console.log(season.name, "·", teams.length, "teams", mock.length ? `· un-mocking ${mock.map((t: { name: string }) => t.name).join(", ")}` : "");

const refs = teams.map((t: { id: string; name: string; division: string }) => ({ id: t.id, name: t.name, group: t.division }));
const { fixtures, spread, warnings } = generateSchedule(refs);
const uneven = spread.filter((s) => Object.values(s.perSlot).some((v) => v !== 2));
console.log(`${fixtures.length} fixtures · ${fixtures[0].date} → ${fixtures.at(-1)!.date}`, uneven.length ? `· UNEVEN: ${uneven.map((s) => s.name)}` : "· every team 2 per slot", warnings.join("; "));
if (!APPLY) process.exit(0);

if (mock.length) await sb.from("teams").update({ is_mock: false }).in("id", mock.map((t: { id: string }) => t.id));
const del = await sb.from("fixtures").delete().eq("season_id", season.id);
if (del.error) throw del.error;
const ins = await sb.from("fixtures").insert(
  fixtures.map((f) => ({
    season_id: season.id, match_no: f.matchNo, stage: f.stage, round: f.round, match_date: f.date, day_name: f.dayName, slot: f.slot,
    group_name: f.groupName, home_team_id: f.homeTeamId, away_team_id: f.awayTeamId, home_label: f.homeLabel, away_label: f.awayLabel,
    venue: f.venue, home_score: null, away_score: null, winner_team_id: null, result_note: null,
  })),
);
if (ins.error) throw ins.error;
const cfg = await sb.from("schedule_config").upsert({
  season_id: season.id, start_date: DEFAULT_CONFIG.startDate, match_days: DEFAULT_CONFIG.matchDays, slots: DEFAULT_CONFIG.slots,
  blackout_dates: [], venue: DEFAULT_CONFIG.venue, seed: DEFAULT_CONFIG.seed, generated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
});
if (cfg.error) throw cfg.error;
console.log("Saved.");
