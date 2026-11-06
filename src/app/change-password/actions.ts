"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type PwState = { error: string } | null;

// First sign-in with the starting password: the owner sets their own, then the
// must_change_password flag (app_metadata, so only the server can clear it)
// comes off and the portal opens.
export async function changePassword(_prev: PwState, form: FormData): Promise<PwState> {
  const password = String(form.get("password") || "");
  const confirm = String(form.get("confirm") || "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message.includes("different") ? "Choose a password other than the starting one." : "Couldn't save the password. Please try again." };

  const admin = createAdminClient();
  const { error: flagErr } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, must_change_password: false },
  });
  if (flagErr) return { error: "Password saved, but the portal didn't unlock. Please sign in again." };

  redirect("/owners");
}
