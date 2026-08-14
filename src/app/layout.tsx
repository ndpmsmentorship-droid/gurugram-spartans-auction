import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Oswald, Jost, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentProfile } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import Nav, { type NavItem } from "./Nav";
import crest from "./brand/crest.png";

// Brand book (p.5) specifies Kaneda Gothic Bold + Brooklyn — both commercial.
// Oswald stands in for Kaneda (condensed heavy grotesque) and Jost for Brooklyn
// (geometric sans). JetBrains Mono carries every number and label.
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});
const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

const SITE_DESCRIPTION =
  "Rank, analyse and buy players on auction day — Shanti Devi Legend League.";

export const metadata: Metadata = {
  // shared as www.ndpms.in/spartansscout — makes the OG/icon URLs absolute
  metadataBase: new URL("https://www.ndpms.in"),
  title: "Shanti Devi Legend League",
  description: SITE_DESCRIPTION,
  applicationName: "Shanti Devi Legend League",
  openGraph: {
    title: "Shanti Devi Legend League — Auction",
    description: SITE_DESCRIPTION,
    siteName: "Shanti Devi Legend League",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shanti Devi Legend League — Auction",
    description: SITE_DESCRIPTION,
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
  const profile = await getCurrentProfile();

  const items: NavItem[] = [
    { href: "/auction", label: "Live Board" },
    { href: "/squad", label: "Squads" },
    ...(profile?.role === "owner" ? [{ href: "/my-team", label: "My Squad" }] : []),
    ...(profile?.role === "admin" ? [{ href: "/scout", label: "Pool" }] : []),
    { href: "https://www.ndpms.in/spartans", label: "Ball Library", external: true },
    ...(profile?.role === "admin"
      ? [{ href: "/admin/auction", label: "Admin" }]
      : []),
  ];

  return (
    <html
      lang="en"
      className={`h-full antialiased ${oswald.variable} ${jost.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
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
              <span className="leading-none">
                <span className="flex items-center font-display text-[1.125rem] font-bold tracking-[0.02em] text-white">
                  Shanti Devi
                  <Stars />
                </span>
                <span className="mt-[4px] block font-mono text-[0.563rem] uppercase tracking-[0.28em] text-white/55">
                  Legend League
                </span>
              </span>
            </Link>

            <Nav items={items} />

            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-white sm:inline-flex">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F0564A] opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#F0564A]" />
                </span>
                Auction Live
              </span>
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
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
