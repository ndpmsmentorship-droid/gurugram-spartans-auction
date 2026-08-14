"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/owner-auth";

export type AuthActionState = { error: string } | null;

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = usernameToEmail(String(formData.get("email") || ""));
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/scout");

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Wrong username/email or password." };

  // When the user came straight to /login (no deep-link), send owners to their
  // squad and everyone else to the pool.
  let dest = next;
  if (next === "/scout" && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role === "owner") dest = "/my-team";
  }

  redirect(dest);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
