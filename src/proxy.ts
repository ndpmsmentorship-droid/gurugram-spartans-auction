import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ALLOWLIST, not a denylist: only the live board and the squad display are
// public. Everything else — schedule, pool, jersey form, player profiles, the
// league record, my-team, admin — needs a login. Inverted deliberately, so a
// new route is private by default rather than public by accident.
//
// /admin/* additionally requires the admin role, enforced in admin/layout.tsx.
const PUBLIC_PATHS = [
  "/login",
  "/auction", // live board
  "/squad", // squad display
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

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

  if (!isPublic(pathname) && !user) {
    // clone() keeps the deployment's basePath (/spartansscout) on the redirect
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // "/" must be listed on its own: the pattern below compiles to a segment
    // that requires at least one character, so the bare root never matched it
    // and the landing page was served without a login.
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
