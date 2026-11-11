// Put paid SLL-2 registrants into the auction pool (scout_players) before they're approved,
// so owners can plan with them (Nikhil, 12 Nov 2026). Same row as the admin "Add to pool"
// button (src/app/admin/registrations/actions.ts addOne): source_id "reg:<id>", stats from
// player_master, selfie copied to the public player-photos bucket. Anyone already in the pool
// (reg:<id>, CricHeroes id or name) is skipped. Rejected / awaiting-payment rows are never added,
// and the Planner hides a row again if its registration is later rejected (reg-pool.ts).
//
//   node scripts/add-review-to-pool.mts            # dry run: who would be added
//   node scripts/add-review-to-pool.mts --apply
import * as fs from "node:fs";
import * as path from "node:path";
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
const SEASON = "SDLL-S2";
const OUT = new Set(["rejected", "awaiting_payment", "withdrawn"]);

const BAT_STYLE: Record<string, string> = { "Left Hand Batsman": "Left-hand bat", "Right Hand Batsman": "Right-hand bat" };
const BOWL_STYLE: Record<string, string> = {
  "Left Arm Pacer": "Left-arm medium",
  "Left Arm Spinner": "Left-arm orthodox",
  "Right Arm Pacer": "Right-arm medium",
  "Right Arm Spin": "Right-arm off-break",
};
const ROLE_NAMES: Record<string, string> = { ALL_ROUNDER: "All-Rounder", BATSMAN: "Batsman", BATTER: "Batsman", BOWLER: "Bowler", WICKET_KEEPER: "Wicket-Keeper" };
const poolRole = (role: string | null | undefined) => (role ? ROLE_NAMES[role.toUpperCase().replace(/[\s-]+/g, "_")] ?? role : null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const roleOf = (r: any) => (r.allrounder ? "All-Rounder" : r.is_keeper ? "Wicket-Keeper" : r.bowling_type && !r.batting_hand ? "Bowler" : r.bowling_type ? "All-Rounder" : "Batsman");
const chId = (link: string | null | undefined) => link?.match(/player-profile\/(\d+)/)?.[1] ?? link?.match(/\/(\d{4,})(?:\/|$)/)?.[1] ?? null;
const nameKey = (n: string | null | undefined) => (n ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const isImage = (url: string | null | undefined) => !!url && !/\.pdf($|\?)/i.test(url);

async function publicPhoto(p: string): Promise<string | null> {
  const { data: file } = await sb.storage.from("registrations").download(p);
  if (!file) return null;
  const dest = `${SEASON}/${p.split("/").slice(-2).join("-")}`;
  const { error } = await sb.storage.from("player-photos").upload(dest, file, { upsert: true, contentType: file.type || "image/jpeg", cacheControl: "31536000" });
  return error ? null : sb.storage.from("player-photos").getPublicUrl(dest).data.publicUrl;
}

const { data: regs } = await sb.from("registrations").select("*").eq("season", SEASON);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const live = (regs ?? []).filter((r: any) => !OUT.has(r.status));
const pool: { id: string; full_name: string; cricheroes_link: string | null; source_id: string | null }[] = [];
for (let o = 0; ; o += 1000) {
  const { data } = await sb.from("scout_players").select("id, full_name, cricheroes_link, source_id").range(o, o + 999);
  pool.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

let added = 0;
for (const r of live) {
  const { data: m } = r.master_id ? await sb.from("player_master").select("*").eq("id", r.master_id).maybeSingle() : { data: null };
  const ch = chId(r.cricheroes_link ?? m?.cricheroes_link);
  const there = pool.some((p) => p.source_id === `reg:${r.id}` || (ch && chId(p.cricheroes_link) === ch) || nameKey(p.full_name) === nameKey(r.full_name));
  if (there) continue;
  console.log(`${APPLY ? "adding" : "would add"}: ${r.full_name} (${r.status})`);
  if (!APPLY) continue;
  const s = (m?.stats ?? {}) as Record<string, number | string>;
  const n = (k: string) => (s[k] === undefined || s[k] === null || s[k] === "" ? null : Number(s[k]));
  const face = r.photo_thumb_path ?? r.photo_path;
  const photo = (face ? await publicPhoto(face) : null) ?? (isImage(m?.photo_url) ? m.photo_url : null);
  const { error } = await sb.from("scout_players").insert({
    source_id: `reg:${r.id}`,
    full_name: r.full_name,
    age: r.dob ? Math.floor((Date.now() - new Date(r.dob).getTime()) / (365.25 * 864e5)) : null,
    phone: r.phone,
    email: r.email,
    photo_url: photo,
    cricheroes_link: r.cricheroes_link ?? m?.cricheroes_link ?? null,
    primary_role: poolRole(m?.primary_role) ?? roleOf(r),
    batting_style: m?.batting_style ?? BAT_STYLE[r.batting_hand] ?? null,
    bowling_style: m?.bowling_style ?? BOWL_STYLE[r.bowling_type] ?? null,
    is_keeper: !!r.is_keeper,
    auction_category: null,
    reg_status: "verified",
    bat_matches: n("matches"),
    runs: n("runs"),
    highest_score: s.highest != null ? String(s.highest) : null,
    bat_avg: n("bat_avg"),
    bat_sr: n("bat_sr"),
    fifties: n("fifties"),
    wickets: n("wickets"),
    economy: n("economy"),
    bowl_avg: n("bowl_avg"),
    catches: n("catches"),
  });
  if (error) throw new Error(`${r.full_name}: ${error.message}`);
  added++;
}

if (APPLY && added) {
  // Same as recomputeAllIndices() (src/lib/scout/recompute.ts): ranks are relative to the whole pool.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = [];
  for (let o = 0; ; o += 1000) {
    const { data, error } = await sb.from("scout_players").select("*").order("id").range(o, o + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const idx = computeIndices(rows);
  const updates = rows.map((r, i) => ({ id: r.id, full_name: r.full_name, ...idx[i] }));
  const { error } = await sb.from("scout_players").upsert(updates, { onConflict: "id" });
  if (error) throw new Error(error.message);
  console.log(`indices recomputed for ${rows.length} pool rows`);
}
console.log(APPLY ? `added ${added}` : "dry run — pass --apply to write");
