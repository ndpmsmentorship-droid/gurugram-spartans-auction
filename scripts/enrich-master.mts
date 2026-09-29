// Fill player_master gaps (photo, last team, role) from the SARDA S6 archive
// (sccl_s6_players) and the SDLL pool (scout_players). Rows are matched on the
// numeric CricHeroes player id inside the profile link, which is stable across
// sheets, unlike spellings of names. Only empty fields are filled.
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

const chId = (link: string | null) => link?.match(/player-profile\/(\d+)/)?.[1] ?? link?.match(/\/(\d{4,})(?:\/|$)/)?.[1] ?? null;

const { data: teams } = await sb.from("teams").select("id, name");
const teamName = new Map<string, string>((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));

const byCh = new Map<string, { photo_url: string | null; team: string | null; role: string | null }>();
for (const [table, season] of [["scout_players", "SDLL S2 pool"], ["sccl_s6_players", "SARDA S6"]] as const) {
  const { data, error } = await sb.from(table).select("cricheroes_link, photo_url, team_id, primary_role").limit(5000);
  if (error) throw new Error(`${table}: ${error.message}`);
  for (const r of data ?? []) {
    const id = chId(r.cricheroes_link);
    if (!id) continue;
    const cur = byCh.get(id) ?? { photo_url: null, team: null, role: null };
    cur.photo_url ??= r.photo_url;
    cur.team ??= r.team_id ? teamName.get(r.team_id) ?? null : null;
    cur.role ??= r.primary_role;
    byCh.set(id, cur);
  }
  console.log(`${table} (${season}): ${data?.length ?? 0} rows indexed`);
}

const { data: master, error } = await sb.from("player_master").select("id, cricheroes_link, photo_url, last_team, primary_role").limit(20000);
if (error) throw new Error(error.message);
let matched = 0, photos = 0, teamsSet = 0;
for (const m of master ?? []) {
  const src = byCh.get(chId(m.cricheroes_link) ?? "");
  if (!src) continue;
  matched++;
  const patch: Record<string, string> = {};
  if (!m.photo_url && src.photo_url) { patch.photo_url = src.photo_url; photos++; }
  if (!m.last_team && src.team) { patch.last_team = src.team; teamsSet++; }
  if (!m.primary_role && src.role) patch.primary_role = src.role;
  if (Object.keys(patch).length) {
    const { error: e } = await sb.from("player_master").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", m.id);
    if (e) throw new Error(e.message);
  }
}
console.log(`master ${master?.length}: matched ${matched} · photos added ${photos} · teams added ${teamsSet}`);
