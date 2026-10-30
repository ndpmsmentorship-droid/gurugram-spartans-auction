// SLL-2 team list from the owners' meet deck ("SHANTI DEVI LEGEND'S LEAGUE- Final.pdf", 30 Oct 2026).
//
//   node scripts/sll2-teams-oct30.mts
//
// Renames the active season's teams in place, so ids, groups, fixtures and
// borrowed squads stay put, and sets every purse to ₹5 L with the ₹1 L top-up
// (purse_remaining moves by the same amount, so any sale already made still counts).
// Safe to re-run.
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

const RENAME: Record<string, string> = {
  "NCR Turbo Chargers": "SLL 10",
  "Patna Panthers": "Diplomats 1",
  "Uttrakhand Yoddhas": "Diplomats 2",
  "Bhojpuri Dabangs": "SLL 13",
  "Japani Tsunami": "SLL 14",
  "Gurugram Spartans": "Gurugram Knights",
  "Chennai Thalaivas": "Chennai Thalaiva",
  "Punjab Royals Legends": "Punjab Royals",
};
const PURSE = 500000, TOPUP = 100000;

const { data: season } = await sb.from("seasons").select("id").eq("is_active", true).single();
const { data: teams } = await sb.from("teams").select("id, name, division, purse_total, purse_remaining").eq("season_id", season.id);
for (const t of teams) {
  const name = RENAME[t.name] ?? t.name;
  const patch: Record<string, unknown> = { name, purse_total: PURSE, purse_max: PURSE + TOPUP };
  if (t.purse_remaining != null) patch.purse_remaining = t.purse_remaining + (PURSE - t.purse_total);
  const r = await sb.from("teams").update(patch).eq("id", t.id);
  if (r.error) throw new Error(`${t.name}: ${r.error.message}`);
  console.log(`${t.division} · ${t.name}${name !== t.name ? " → " + name : ""} · purse ₹${PURSE} (+₹${TOPUP}) · left ₹${patch.purse_remaining ?? "—"}`);
}
