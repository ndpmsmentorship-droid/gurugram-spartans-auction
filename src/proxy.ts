import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LEAGUE, usclClosed } from "@/lib/league";

// ALLOWLIST, not a denylist: only the landing page ("/", exact), the live
// board and the squad display are public. Everything else — schedule, pool, jersey form, player profiles, the
// league record, my-team, admin — needs a login. Inverted deliberately, so a
// new route is private by default rather than public by accident.
//
// /admin/* additionally requires the admin role, enforced in admin/layout.tsx.
// While the USCL demo runs (src/lib/league.ts) the board and squads are for
// signed-in users only — Gurugram Spartans' private war room.
const PUBLIC_PATHS = [
  "/login",
  "/register", // player registration form
  ...(LEAGUE === "uscl" ? [] : ["/auction", "/squad"]), // live board, squad display
];

function isPublic(pathname: string): boolean {
  // The landing page is public, but only as an exact match: "/" as a prefix
  // would make every route public.
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Local design preview — no Supabase, treat every request as a signed-in admin.
  if (process.env.SPARTANS_DEV_FIXTURE === "1") return response;

  // Public pages need no auth decision here, so skip the Supabase round-trip
  // (it ran on every tap and made navigation feel slow on phones). Signed-in
  // users' sessions still refresh on the next private page they open.
  if (isPublic(request.nextUrl.pathname)) return response;

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

  // Role gate (one extra lookup, only on pages that need it). The pool import
  // is admin-only always; during the USCL soft launch the 14 franchise owners
  // get the war room, the live board and player pages — nothing else.
  const usclOwnerOk = ["/war-room", "/auction", "/players"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // After the USCL cut-off nobody but the admin gets past the login page.
  if (user && usclClosed()) {
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (prof?.role !== "admin") {
      await supabase.auth.signOut();
      const closed = request.nextUrl.clone();
      closed.pathname = "/login";
      closed.search = "?closed=1";
      const out = NextResponse.redirect(closed);
      for (const c of response.cookies.getAll()) out.cookies.set(c);
      return out;
    }
    return response;
  }
  if (user && (pathname.startsWith("/scout/import") || (LEAGUE === "uscl" && !usclOwnerOk))) {
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (prof?.role !== "admin") {
      const home = request.nextUrl.clone();
      home.pathname = "/war-room";
      home.search = "";
      return NextResponse.redirect(home);
    }
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
