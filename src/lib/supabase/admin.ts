import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { DEV_FIXTURE, createFixtureClient } from "@/lib/dev/fake-supabase";

/**
 * Service-role client — bypasses RLS. Server-only (CSV import, mock team
 * seeding, admin operations). Never import this from a Client Component.
 *
 * With SPARTANS_DEV_FIXTURE=1 (local design preview only) this returns an
 * in-memory fixture instead, so the UI can be built without production keys.
 */
export function createAdminClient() {
  if (DEV_FIXTURE) {
    return createFixtureClient() as unknown as ReturnType<
      typeof createSupabaseClient<Database>
    >;
  }
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
