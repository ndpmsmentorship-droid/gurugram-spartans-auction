import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

// Third-party vetter: may review registrations (profiles, CricHeroes, LinkedIn,
// vetting notes) but sees no contact details, Aadhaar or payments and can't
// approve. The role lives on the auth user's app_metadata.
export async function isVetter(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.app_metadata?.role === "vetter";
}

export async function getActiveSeason() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seasons")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  return data;
}
