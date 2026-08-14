"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToEmail, isValidUsername } from "@/lib/owner-auth";

export type OwnerActionState = { error?: string; ok?: string } | null;

async function assertAdmin(): Promise<boolean> {
  const p = await getCurrentProfile();
  return !!p && p.role === "admin";
}

// Create a team-owner login: a Supabase auth user (username → internal email),
// role 'owner', linked to the chosen team.
export async function createOwner(
  _prev: OwnerActionState,
  form: FormData
): Promise<OwnerActionState> {
  if (!(await assertAdmin())) return { error: "Not authorized." };

  const teamId = String(form.get("teamId") || "");
  const name = String(form.get("name") || "").trim();
  const username = String(form.get("username") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  if (!teamId || !name) return { error: "Team and owner name are required." };
  if (!isValidUsername(username))
    return { error: "Username: 3–40 chars, lowercase letters/numbers/_.- only." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  const admin = createAdminClient();

  const { data: team } = await admin
    .from("teams")
    .select("id, name, owner_profile_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { error: "Team not found." };
  if ((team as { owner_profile_id: string | null }).owner_profile_id)
    return { error: "That team already has an owner — remove it first." };

  const email = usernameToEmail(username);
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (cErr || !created?.user) {
    const msg = cErr?.message || "";
    return {
      error: /registered|already|exists/i.test(msg)
        ? "That username is already taken."
        : msg || "Could not create the login.",
    };
  }

  const uid = created.user.id;
  // The on-signup trigger inserts the profile; make sure name + role are right.
  await admin.from("profiles").update({ display_name: name, role: "owner" }).eq("id", uid);
  const { error: tErr } = await admin
    .from("teams")
    .update({ owner_profile_id: uid })
    .eq("id", teamId);
  if (tErr) {
    await admin.auth.admin.deleteUser(uid); // roll back the orphan user
    return { error: "Could not link the team. Nothing was created." };
  }

  revalidatePath("/admin/owners");
  return { ok: `Login created for ${(team as { name: string }).name} — username “${username}”.` };
}

export async function resetOwnerPassword(
  _prev: OwnerActionState,
  form: FormData
): Promise<OwnerActionState> {
  if (!(await assertAdmin())) return { error: "Not authorized." };
  const uid = String(form.get("ownerId") || "");
  const password = String(form.get("password") || "");
  if (!uid) return { error: "Missing owner." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(uid, { password });
  if (error) return { error: error.message };
  revalidatePath("/admin/owners");
  return { ok: "Password updated." };
}

// Unlink the owner from the team and delete the login entirely.
export async function removeOwner(
  _prev: OwnerActionState,
  form: FormData
): Promise<OwnerActionState> {
  if (!(await assertAdmin())) return { error: "Not authorized." };
  const teamId = String(form.get("teamId") || "");
  const uid = String(form.get("ownerId") || "");
  if (!teamId || !uid) return { error: "Missing team or owner." };

  const admin = createAdminClient();
  await admin.from("teams").update({ owner_profile_id: null }).eq("id", teamId);
  await admin.auth.admin.deleteUser(uid); // cascade removes the profile row
  revalidatePath("/admin/owners");
  return { ok: "Owner login removed." };
}
