"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Back button + breadcrumb trail under the sponsor bar on every page but Home.
// usePathname() excludes the /spartansscout basePath, so paths compare cleanly.
const LABELS: Record<string, string> = {
  "/register": "Register",
  "/auction": "Live Board",
  "/squad": "Squads",
  "/schedule": "Schedule",
  "/my-team": "My Squad",
  "/my-team/targets": "Targets",
  "/scout": "Player Pool",
  "/scout/compare": "Compare",
  "/scout/import": "Import",
  "/admin": "Admin",
  "/admin/auction": "Auction Console",
  "/admin/registrations": "Registrations",
  "/admin/owners": "Team Owners",
  "/admin/teams": "Teams",
  "/admin/players": "Players",
  "/admin/schedule": "Schedule Admin",
  "/players": "Players",
  "/team": "Team",
  "/jersey": "Jersey",
  "/sarda": "SARDA Record",
  "/login": "Sign in",
};

// Segments that have no page of their own: link them to their natural index.
const FALLBACK: Record<string, string> = { "/admin": "/admin/auction" };

function trail(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const out: { href: string; label: string }[] = [];
  let acc = "";
  for (const part of parts) {
    acc += `/${part}`;
    const label = LABELS[acc] ?? (/^[0-9a-f-]{8,}$/i.test(part) ? "Profile" : decodeURIComponent(part));
    out.push({ href: FALLBACK[acc] ?? acc, label });
  }
  return out;
}

export default function Crumbs() {
  const pathname = usePathname();
  const router = useRouter();
  // The layout (and so this component) survives client-side navigation, so
  // any path change since mount means there is an in-app page to go back to.
  const first = useRef(pathname);
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    if (pathname !== first.current) setMoved(true);
  }, [pathname]);
  if (pathname === "/") return null;

  const crumbs = trail(pathname);
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2].href : "/";

  function back() {
    // Step back through history only when the previous page was ours (moved
    // in-app, or arrived from another page of this site); otherwise, as with
    // a shared link or a new tab, go up one level instead of leaving the site.
    let internal = moved;
    try {
      internal ||= !!document.referrer && new URL(document.referrer).host === location.host && history.length > 1;
    } catch {}
    if (internal) router.back();
    else router.push(parent);
  }

  return (
    <div className="border-b border-line bg-wash">
      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex h-10 max-w-[1400px] items-center gap-3 overflow-x-auto whitespace-nowrap px-4 text-[0.75rem] sm:px-7 [scrollbar-width:none]"
      >
        <button
          type="button"
          onClick={back}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line2 bg-surface px-3 py-1 font-medium text-ink transition hover:border-red hover:text-red"
        >
          <span aria-hidden>←</span> Back
        </button>
        <ol className="flex items-center gap-1.5 text-muted">
          <li>
            <Link href="/" className="hover:text-red">
              Home
            </Link>
          </li>
          {crumbs.map((c, i) => (
            <li key={c.href + i} className="flex items-center gap-1.5">
              <span aria-hidden className="text-faint">
                ›
              </span>
              {i === crumbs.length - 1 ? (
                <span aria-current="page" className="font-medium text-ink">
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="hover:text-red">
                  {c.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
