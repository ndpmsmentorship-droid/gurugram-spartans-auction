// One owner login per SLL-2 franchise, so owners can track registrations in
// the owners' portal (/owners) and later bid. Made 7 Nov 2026 from the USCL script.
//
//   node scripts/sll2-owner-logins.mts            # create the missing ones
//
// For every team in the USCL season that has no owner yet: an auth user
// <username>@owners.sdll, a profiles row (role owner, display name = team) and
// teams.owner_profile_id. Teams that already have an owner are left alone, so
// it is safe to re-run. New usernames + passwords are written ONCE to
// ~/Downloads/uscl-owner-logins.csv (never to the repo) — hand them out from there.
// Owners see their own team's War Room, squad and the live board; recording
// sales stays admin-only.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomInt } from "node:crypto";
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

// Short, typeable usernames; anything not listed falls back to the name squashed.
const USERNAME: Record<string, string> = {
  // These two owners already had logins before the SLL-2 rename: re-linked, password kept.
  ACCI: "theacciowner",
  "Bengal Tigers": "thebengaltigers",
  "Chennai Thalaiva": "chennai",
  "Goan Monks": "goanmonks",
  "Gurugram Knights": "gknights",
  "Jaipur Royals": "jaipur",
  "Lucknow Strikers": "lucknow",
  "Punjab Royals": "punjab",
  "Tokyo Drifters": "tokyodrifters",
  "UP Warriors": "upwarriors",
};
// Teams whose owners aren't confirmed yet get no login (Diplomats 1/2, SLL 13/14).
const usernameOf = (team: string) => USERNAME[team] ?? team.toLowerCase().replace(/[^a-z0-9]/g, "");

const WORDS = ["Cover", "Drive", "Yorker", "Sixer", "Googly", "Bouncer", "Century", "Spinner", "Sweep", "Hook"];
const password = () => `${WORDS[randomInt(WORDS.length)]}-${WORDS[randomInt(WORDS.length)]}-${randomInt(1000, 9999)}`;

const { data: season } = await sb.from("seasons").select("id, name").eq("is_active", true).single();
if (!season) throw new Error("No active season");
const { data: teams } = await sb.from("teams").select("id, name, owner_profile_id").eq("season_id", season.id).order("name");

const users = (await sb.auth.admin.listUsers({ perPage: 1000 })).data.users as { id: string; email: string }[];
const rows: string[] = [];
for (const t of teams) {
  if (!USERNAME[t.name]) {
    console.log(`skip  ${t.name} (owner not confirmed)`);
    continue;
  }
  if (t.owner_profile_id) {
    console.log(`skip  ${t.name} (has an owner login)`);
    continue;
  }
  const username = usernameOf(t.name);
  const email = `${username}@owners.sdll`;
  const existing = users.find((u) => u.email === email);
  if (existing) {
    const l = await sb.from("teams").update({ owner_profile_id: existing.id }).eq("id", t.id);
    if (l.error) throw new Error(`${t.name} link: ${l.error.message}`);
    console.log(`link  ${t.name} → ${username} (existing login, password unchanged)`);
    continue;
  }
  const pw = password();
  const c = await sb.auth.admin.createUser({ email, password: pw, email_confirm: true });
  if (c.error) throw new Error(`${t.name}: ${c.error.message}`);
  const uid = c.data.user.id;
  await new Promise((r) => setTimeout(r, 600)); // the profiles trigger
  const p = await sb.from("profiles").upsert({ id: uid, display_name: t.name, role: "owner" });
  if (p.error) throw new Error(`${t.name} profile: ${p.error.message}`);
  const l = await sb.from("teams").update({ owner_profile_id: uid }).eq("id", t.id);
  if (l.error) throw new Error(`${t.name} link: ${l.error.message}`);
  rows.push(`${t.name},${username},${pw}`);
  console.log(`made  ${t.name} → ${username}`);
}

if (rows.length) {
  const out = path.join(os.homedir(), "Downloads", "SDLL", "Teams & Owners", "SLL-2 owner logins.csv");
  const fresh = !fs.existsSync(out);
  fs.appendFileSync(out, (fresh ? "Team,Username,Password\n" : "") + rows.join("\n") + "\n", { mode: 0o600 });
  console.log(`\n${rows.length} new login(s) → ${out}`);
} else console.log("\nNothing to do.");
