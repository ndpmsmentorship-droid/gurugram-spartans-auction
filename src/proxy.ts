import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /auction (live board), /squad (final squad display) and /jersey (size form) are
// PUBLIC — read-only, service-role data. Everything below stays login-gated.
const PROTECTED_PREFIXES = [
  "/admin",
  "/my-team",
  "/players",
  "/scout",
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Local design preview — no Supabase, treat every request as a signed-in admin.
  if (process.env.SPARTANS_DEV_FIXTURE === "1") return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  // Player profile pages (/scout/<uuid>) are public — the pool board and tools stay gated.
  const isPublicProfile = /^\/scout\/[0-9a-f-]{36}$/.test(pathname);
  const isProtected =
    !isPublicProfile && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !user) {
    // clone() keeps the deployment's basePath (/spartansscout) on the redirect
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
