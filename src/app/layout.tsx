import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import localFont from "next/font/local";
import "./globals.css";
import { getCurrentProfile } from "@/lib/auth";
import { isAuctionLive } from "@/lib/auction/state";
import { signOut } from "@/app/login/actions";
import Nav, { type NavItem } from "./Nav";
import sdllCrest from "./brand/crest.png";
import usclCrest from "./brand/uscl-crest.png";
import { LEAGUE } from "@/lib/league";
import SponsorBar from "./SponsorBar";
import Crumbs from "./Crumbs";
import NavProgress from "./NavProgress";
import { DEMO_MODE } from "./site-config";

// Brand book (p.5) specifies Kaneda Gothic Bold + Brooklyn — both commercial.
// Oswald stands in for Kaneda (condensed heavy grotesque) and Jost for Brooklyn
// (geometric sans). JetBrains Mono carries every number and label.
// Self-hosted variable fonts (latin subset, from Google Fonts): next/font/google
// downloads them at build time and that download intermittently failed the
// Vercel build ("next/font/google queries have exactly one entry").
const oswald = localFont({
  src: "./fonts/oswald.woff2",
  weight: "200 700",
  variable: "--font-oswald",
  display: "swap",
});
const jost = localFont({
  src: "./fonts/jost.woff2",
  weight: "100 900",
  variable: "--font-jost",
  display: "swap",
});
const jetbrains = localFont({
  src: "./fonts/jetbrainsmono.woff2",
  weight: "100 800",
  variable: "--font-jetbrains",
  display: "swap",
});

// The masthead follows the league the auction side is running (src/lib/league.ts):
// USCL while its auction is switched in (soft launch), SDLL otherwise.
const USCL = LEAGUE === "uscl";
const SITE_NAME = USCL ? "USCL Auction" : "Shanti Devi Legend League";
const crest = USCL ? usclCrest : sdllCrest;
const SITE_DESCRIPTION = USCL
  ? "Urban Sports Champions League Season 2 — live auction, squads and the franchise war room."
  : "Rank, analyse and buy players on auction day — Shanti Devi Legend League.";

// Icons + share card live in public/brand/meta and are referenced by FULL path:
// the app is served under /spartansscout on www.ndpms.in, and Next's file-based
// icon/OG routes emitted "/icon", which on ndpms.in is the SMIFE site's icon.
const META = `/spartansscout/brand/meta/${USCL ? "uscl" : "sdll"}`;
const SHARE_TITLE = USCL ? SITE_NAME : `${SITE_NAME} — Auction`;
const OG_IMAGE = {
  url: `${META}-og.png`,
  width: 1200,
  height: 630,
  alt: USCL ? "USCL Auction — Urban Sports Champions League Season 2" : "Gurugram Spartans",
};

export const metadata: Metadata = {
  // shared as www.ndpms.in/spartansscout — makes the OG/icon URLs absolute
  metadataBase: new URL("https://www.ndpms.in"),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  icons: { icon: `${META}-icon.png`, apple: `${META}-apple-icon.png` },
  openGraph: {
    title: SHARE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// The three brand stars from the crest, carried into the masthead lockup.
function Stars() {
  return (
    <span className="ml-1 inline-flex items-center gap-[3px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className="h-[9px] w-[9px]">
          <path
            d="M12 2.5l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.9 6.4 19.7l1.3-6.3L2.9 9.1l6.4-.7L12 2.5z"
            fill="#C2352C"
          />
        </svg>
      ))}
    </span>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // In parallel: these were sequential Supabase round-trips on every request.
  const [profile, auctionLive] = await Promise.all([getCurrentProfile(), isAuctionLive()]);

  // Only the two public routes are advertised to a signed-out visitor —
  // everything else redirects to /login (see proxy.ts), so linking to it from
  // the masthead would just bounce them.
  const LIBRARY: NavItem = { href: "https://www.ndpms.in/spartans/?from=uscl", label: "Ball Library", external: true };
  const items: NavItem[] = USCL
    ? // USCL soft launch: only the pages that work for USCL owners.
      [
        ...(profile ? [{ href: "/war-room", label: "War Room" }] : []),
        { href: "/auction", label: "Live Board" },
        LIBRARY,
        ...(profile?.role === "admin" ? [{ href: "/admin/auction", label: "Admin" }] : []),
      ]
    : DEMO_MODE
    ? // Demo: every major page for everyone (locked pages bounce to Sign in).
      [
        { href: "/register", label: "Register" },
        { href: "/auction", label: "Live Board" },
        { href: "/squad", label: "Squads" },
        { href: "/schedule", label: "Schedule" },
        { href: "/my-team", label: "My Squad" },
        { href: "/war-room", label: "War Room" },
        { href: "/scout", label: "Pool" },
        { href: "/admin/auction", label: "Admin" },
        LIBRARY,
      ]
    : [
        { href: "/auction", label: "Live Board" },
        // Player registration is for the public, not for signed-in owners/admins.
        ...(profile ? [] : [{ href: "/register", label: "Register" }]),
        // The Squads showcase is the single Gurugram Spartans team page — hidden
        // from owners, who have their own My Squad instead.
        ...(profile?.role === "owner" ? [] : [{ href: "/squad", label: "Squads" }]),
        ...(profile ? [{ href: "/schedule", label: "Schedule" }] : []),
        ...(profile?.role === "owner"
          ? [
              { href: "/war-room", label: "War Room" },
              { href: "/my-team", label: "My Squad" },
              { href: "/my-team/targets", label: "Targets" },
            ]
          : []),
        ...(profile?.role === "admin" ? [{ href: "/scout", label: "Pool" }] : []),
        LIBRARY,
        ...(profile?.role === "admin" ? [{ href: "/admin/auction", label: "Admin" }] : []),
      ];

  return (
    <html
      lang="en"
      className={`h-full antialiased ${oswald.variable} ${jost.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NavProgress />
        {/* Auto-sync disabled post-auction — squad is curated manually now.
            Re-enable <AuctionSync /> if the live mirror is needed again. */}
        <header
          className="band sticky top-0 z-30"
          style={{ borderBottom: "2px solid var(--red)" }}
        >
          <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-7">
            <Link href="/" className="inline-flex shrink-0 items-center gap-2.5">
              <Image
                src={crest}
                alt=""
                width={34}
                height={46}
                priority
                className="h-[36px] w-auto"
              />
              {/* USCL runs on the SDLL portal — the SDLL crest rides alongside as marketing */}
              {USCL && (
                <Image
                  src={sdllCrest}
                  alt="Shanti Devi Legend League"
                  title="Powered by the Shanti Devi Legend League portal"
                  width={34}
                  height={46}
                  className="-ml-1 h-[36px] w-auto"
                />
              )}
              <span className="leading-none">
                <span className="flex items-center font-display text-[1.125rem] font-bold tracking-[0.02em] text-white">
                  {USCL ? <>USCL<span className="hidden sm:inline">&nbsp;Auction</span></> : "Shanti Devi"}
                  {!USCL && <Stars />}
                </span>
                <span className={`mt-[4px] font-mono text-[0.563rem] uppercase tracking-[0.28em] text-white/55 ${USCL ? "hidden sm:block" : "block"}`}>
                  {USCL ? "Champions League · S2" : "Legend League"}
                </span>
              </span>
            </Link>

            <Nav items={items} />

            <div className="flex shrink-0 items-center gap-3">
              {/* Reflects the actual lot state — it used to be hardcoded, so the
                  masthead claimed a live auction at all times. */}
              {auctionLive ? (
                <span className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-white sm:inline-flex">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F0564A] opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#F0564A]" />
                  </span>
                  Auction Live
                </span>
              ) : (
                <span className="hidden items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-white/45 sm:inline-flex">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-white/30" />
                  Auction Idle
                </span>
              )}
              {profile ? (
                <form action={signOut}>
                  <button
                    type="submit"
                    className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-white/55 transition hover:text-white"
                  >
                    Sign out
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-white/55 transition hover:text-white"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>
        {/* SDLL's partners — not USCL's, so hidden while USCL is switched in */}
        {!USCL && <SponsorBar />}
        <Crumbs />
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
