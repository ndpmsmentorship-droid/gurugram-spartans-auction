import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import { getCurrentProfile } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import SpartansStars from "./SpartansStars";
import spartansMark from "./spartans-mark.png";

const SITE_DESCRIPTION =
  "Rank, analyze and buy players on auction day for The Gurugram Spartans.";

export const metadata: Metadata = {
  // shared as www.ndpms.in/spartansscout — makes the OG/icon URLs absolute
  metadataBase: new URL("https://www.ndpms.in"),
  title: "Spartans Scout",
  description: SITE_DESCRIPTION,
  applicationName: "Spartans Scout",
  openGraph: {
    title: "Spartans Scout — The Gurugram Spartans",
    description: SITE_DESCRIPTION,
    siteName: "Spartans Scout",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Spartans Scout — The Gurugram Spartans",
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Auto-sync disabled post-auction — squad is curated manually now.
            Re-enable <AuctionSync /> if the live mirror is needed again. */}
        <header className="sticky top-0 z-30 border-b border-border/70 bg-[color-mix(in_srgb,var(--background)_80%,transparent)] backdrop-blur-xl">
          <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-3 px-4 sm:px-5">
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-2 text-[0.95rem] font-semibold tracking-tight"
            >
              <Image
                src={spartansMark}
                alt="Gurugram Spartans"
                width={26}
                height={26}
                priority
                className="rounded-md ring-1 ring-border/60"
              />
              Spartans Scout <SpartansStars />
            </Link>
            <nav className="flex items-center gap-4 overflow-x-auto whitespace-nowrap text-[0.8rem] text-muted sm:gap-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* public live auction board — visible to everyone */}
              <Link href="/auction" className="transition hover:text-foreground">
                Live Board
              </Link>
              {/* cross-app link to the public Spartans ball library (root, not basePath) */}
              <a
                href="https://www.ndpms.in/spartans"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden transition hover:text-foreground sm:inline"
              >
                Ball Library ↗
              </a>
              {profile ? (
                <>
                  <Link href="/scout" className="transition hover:text-foreground">
                    Pool
                  </Link>
                  <Link href="/squad" className="transition hover:text-foreground">
                    <span className="sm:hidden">Squad</span>
                    <span className="hidden sm:inline">Season 6 Squad</span>
                  </Link>
                  {profile.role === "admin" && (
                    <Link href="/admin/auction" className="font-medium text-accent-text transition hover:text-foreground">
                      Admin
                    </Link>
                  )}
                  <form action={signOut}>
                    <button type="submit" className="transition hover:text-down">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="transition hover:text-foreground">
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
