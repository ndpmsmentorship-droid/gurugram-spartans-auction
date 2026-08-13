import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { DEV_FIXTURE, createFixtureClient } from "@/lib/dev/fake-supabase";

export async function createClient() {
  // Local design preview (SPARTANS_DEV_FIXTURE=1) — signed in as a fixture admin.
  if (DEV_FIXTURE) {
    return createFixtureClient() as unknown as ReturnType<
      typeof createServerClient<Database>
    >;
  }
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll called from a Server Component - safe to ignore
            // because the proxy refreshes the session on every request.
          }
        },
      },
    }
  );
}
