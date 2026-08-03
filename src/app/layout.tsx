import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentProfile } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import SpartansStars from "./SpartansStars";

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
        <header className="sticky top-0 z-30 border-b border-border/70 bg-[color-mix(in_srgb,var(--background)_80%,transparent)] backdrop-blur-xl">
          <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[0.95rem] font-semibold tracking-tight"
            >
              Spartans Scout <SpartansStars />
            </Link>
            <nav className="flex items-center gap-6 text-[0.8rem] text-muted">
              {profile ? (
                <>
                  <Link href="/scout" className="transition hover:text-foreground">
                    Pool
                  </Link>
                  <Link href="/squad" className="transition hover:text-foreground">
                    Season 6 Squad
                  </Link>
                  <Link href="/scout/import" className="transition hover:text-foreground">
                    Import
                  </Link>
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
