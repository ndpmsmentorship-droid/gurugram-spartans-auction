// Puts every linked SLL-2 owner login on the starting password with a forced
// change at first sign-in (Nikhil, 7 Nov 2026). The portal sends a flagged
// owner to /change-password and nothing else opens until they set their own.
//
//   node --env-file=.env.local --experimental-strip-types scripts/sll2-owner-reset.mts
import { createClient } from "@supabase/supabase-js";
const START = "12345678";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: season } = await sb.from("seasons").select("id").eq("is_active", true).single();
const { data: teams } = await sb.from("teams").select("name, owner_profile_id").eq("season_id", season.id).not("owner_profile_id", "is", null).order("name");
for (const t of teams) {
  const { data: u } = await sb.auth.admin.getUserById(t.owner_profile_id);
  const user = u?.user;
  const { data: prof } = await sb.from("profiles").select("role").eq("id", t.owner_profile_id).maybeSingle();
  if (!user || prof?.role !== "owner") { console.log(`skip  ${t.name} (not an owner account)`); continue; }
  const { error } = await sb.auth.admin.updateUserById(user.id, { password: START, app_metadata: { ...user.app_metadata, must_change_password: true } });
  console.log(error ? `FAIL  ${t.name}: ${error.message}` : `reset ${t.name} → ${user.email.split("@")[0]}`);
}
