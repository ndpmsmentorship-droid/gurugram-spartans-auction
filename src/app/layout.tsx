import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Oswald, Jost, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentProfile } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import crest from "./brand/crest.png";

// Brand book (p.5) specifies Kaneda Gothic Bold + Brooklyn — both commercial.
// Oswald stands in for Kaneda (condensed heavy grotesque) and Jost for Brooklyn
// (geometric sans). JetBrains Mono carries every number and label, which is a
// house choice, not a brand-book one. next/font self-hosts all three.
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getCurrentProfile();

  return (
    <html
      lang="en"
      className={`h-full antialiased ${oswald.variable} ${jost.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Auto-sync disabled post-auction — squad is curated manually now.
            Re-enable <AuctionSync /> if the live mirror is needed again. */}
        <header
          className="sticky top-0 z-30 border-b-2"
          style={{
            background:
              "linear-gradient(180deg, var(--maroon) 0%, var(--maroon) 62%, color-mix(in srgb, var(--maroon) 92%, transparent) 100%)",
            borderBottomColor: "var(--red)",
          }}
        >
          <div className="mx-auto flex h-14 max-w-[1360px] items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/" className="inline-flex shrink-0 items-center gap-2.5">
              <Image
                src={crest}
                alt=""
                width={34}
                height={46}
                priority
                className="h-[34px] w-auto"
              />
              <span className="leading-none">
                <span className="block font-display text-[1.0625rem] font-bold tracking-[0.02em] text-white">
                  Shanti Devi
                </span>
                <span className="mt-[3px] block font-mono text-[0.5625rem] uppercase tracking-[0.22em] text-white/60">
                  Legend League
                </span>
              </span>
            </Link>
            <nav className="flex items-center gap-4 overflow-x-auto whitespace-nowrap font-mono text-[0.625rem] uppercase tracking-[0.14em] text-white/60 sm:gap-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* public pages — visible to everyone */}
              <Link href="/auction" className="transition hover:text-white">
                Live Board
              </Link>
              <Link href="/squad" className="transition hover:text-white">
                Squad
              </Link>
              {/* cross-app link to the public Spartans ball library (root, not basePath) */}
              <a
                href="https://www.ndpms.in/spartans"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden transition hover:text-white sm:inline"
              >
                Ball Library ↗
              </a>
              {profile ? (
                <>
                  <Link href="/scout" className="transition hover:text-white">
                    Pool
                  </Link>
                  {profile.role === "admin" && (
                    <Link
                      href="/admin/auction"
                      className="text-white/90 transition hover:text-white"
                    >
                      Admin
                    </Link>
                  )}
                  <form action={signOut}>
                    <button
                      type="submit"
                      className="font-mono uppercase tracking-[0.14em] transition hover:text-white"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="transition hover:text-white">
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
