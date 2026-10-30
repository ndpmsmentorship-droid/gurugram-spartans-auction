// A demo owner login for showing the Owners Portal (owners' meeting, prospects).
//
//   node scripts/demo-owner-login.mts            # create + link to Gurugram Knights
//   node scripts/demo-owner-login.mts --unlink   # free the team for its real owner
//
// Creates the auth user demo@owners.sdll (username "demo") with a profiles row
// (role owner) and links it as owner of one active-season franchise, so the
// War Room, My Squad and targets load exactly as a real owner sees them. Owners
// can't record sales, so nothing reaches the live board. Nothing is written to
// players. The password is printed once and never saved.
import * as fs from "node:fs";
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

const TEAM = "Gurugram Knights";
const EMAIL = "demo@owners.sdll";
const WORDS = ["Cover", "Drive", "Yorker", "Sixer", "Googly", "Bouncer", "Century", "Spinner", "Sweep", "Hook"];
const password = () => `${WORDS[randomInt(WORDS.length)]}-${WORDS[randomInt(WORDS.length)]}-${randomInt(1000, 9999)}`;

const { data: season } = await sb.from("seasons").select("id, name").eq("is_active", true).single();
const { data: team } = await sb.from("teams").select("id, name, owner_profile_id").eq("season_id", season.id).eq("name", TEAM).single();
const users = (await sb.auth.admin.listUsers({ perPage: 1000 })).data.users as { id: string; email: string }[];
let user = users.find((u) => u.email === EMAIL);

if (process.argv.includes("--unlink")) {
  if (user && team.owner_profile_id === user.id) await sb.from("teams").update({ owner_profile_id: null }).eq("id", team.id);
  console.log(`unlinked demo from ${TEAM}`);
  process.exit(0);
}

if (team.owner_profile_id && team.owner_profile_id !== user?.id) throw new Error(`${TEAM} already has a real owner — pick another team`);

const pw = password();
if (user) {
  const u = await sb.auth.admin.updateUserById(user.id, { password: pw });
  if (u.error) throw new Error(u.error.message);
} else {
  const c = await sb.auth.admin.createUser({ email: EMAIL, password: pw, email_confirm: true });
  if (c.error) throw new Error(c.error.message);
  user = c.data.user;
  await new Promise((r) => setTimeout(r, 600)); // the profiles trigger
}
const p = await sb.from("profiles").upsert({ id: user!.id, display_name: "Demo Owner", role: "owner" });
if (p.error) throw new Error(p.error.message);
const t = await sb.from("teams").update({ owner_profile_id: user!.id }).eq("id", team.id);
if (t.error) throw new Error(t.error.message);

console.log(`demo owner → ${season.name} · ${TEAM}`);
console.log(`username: demo   password: ${pw}`);
