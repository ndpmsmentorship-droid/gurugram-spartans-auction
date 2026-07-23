import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getCurrentProfile } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gurugram Spartans — Auction Command Center",
  description: "Live auction platform for The Gurugram Spartans",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
            <Link href="/" className="font-semibold">
              Gurugram Spartans
            </Link>
            {profile && (
              <nav className="flex items-center gap-5 text-sm">
                <Link href="/auction" className="hover:text-primary">
                  Auction
                </Link>
                <Link href="/my-team" className="hover:text-primary">
                  My Team
                </Link>
                <Link href="/players" className="hover:text-primary">
                  Players
                </Link>
                {profile.role === "admin" && (
                  <Link href="/admin/auction" className="hover:text-primary">
                    Admin
                  </Link>
                )}
                <span className="text-muted">{profile.display_name}</span>
                <form action={signOut}>
                  <button type="submit" className="text-muted hover:text-danger">
                    Sign out
                  </button>
                </form>
              </nav>
            )}
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
