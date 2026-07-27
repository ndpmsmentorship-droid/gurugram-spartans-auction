import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getCurrentProfile } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Spartans Scout — Auction Command",
  description: "Rank, analyze and buy players on auction day for The Gurugram Spartans",
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
      className={`${spaceGrotesk.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
            <Link href="/" className="flex items-center gap-2 font-display font-bold">
              <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-accent text-ink">
                S
              </span>
              Spartans Scout
            </Link>
            <nav className="flex items-center gap-4 text-[0.9rem]">
              {profile ? (
                <>
                  <Link href="/scout" className="hover:text-accent-text">
                    Pool
                  </Link>
                  <Link href="/squad" className="hover:text-accent-text">
                    Squad
                  </Link>
                  <Link href="/scout/import" className="hover:text-accent-text">
                    Import
                  </Link>
                  <span className="hidden text-muted sm:inline">
                    {profile.display_name}
                  </span>
                  <form action={signOut}>
                    <button
                      type="submit"
                      className="text-muted hover:text-down"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="btn-primary">
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
