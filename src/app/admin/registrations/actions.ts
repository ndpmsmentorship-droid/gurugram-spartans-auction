"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Review actions for /admin/registrations. Server actions are callable
// directly, so each one re-checks the admin role instead of relying on the
// admin layout's redirect.
async function adminId(): Promise<string | null> {
  const p = await getCurrentProfile();
  return p && p.role === "admin" ? p.id : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as unknown as { from: (t: string) => any };

async function update(id: string, patch: Record<string, unknown>) {
  const by = await adminId();
  if (!by || !id) return;
  await db()
    .from("registrations")
    .update({ ...patch, reviewed_by: by, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/registrations");
}

// LinkedIn check is manual: the admin opens the profile and ticks what they see.
// Fewer than 500 connections parks the player in "under review".
export async function markLinkedin(form: FormData) {
  const ok = form.get("verdict") === "yes";
  await update(String(form.get("id") || ""), ok
    ? { linkedin_verified: true }
    : { linkedin_verified: false, status: "under_review" });
}

// Approving someone whose LinkedIn hasn't been confirmed at 500+ lands them in
// "under review" instead, per the league rule.
export async function setStatus(form: FormData) {
  const id = String(form.get("id") || "");
  const status = String(form.get("status") || "");
  if (!["approved", "under_review", "rejected", "pending"].includes(status)) return;
  if (status === "approved") {
    const { data } = await db().from("registrations").select("linkedin_verified").eq("id", id).maybeSingle();
    if (!data?.linkedin_verified) return update(id, { status: "under_review" });
  }
  await update(id, { status });
}
