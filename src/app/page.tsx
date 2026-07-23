import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";

export default async function Home() {
  const profile = await getCurrentProfile();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">Gurugram Spartans</h1>
        <p className="mt-2 text-muted">
          Auction Command Center — practice bidding ahead of the real Sarda
          Corporate Cricket League auction.
        </p>
        <Link
          href={profile ? "/auction" : "/login"}
          className="mt-6 inline-block rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
        >
          {profile ? "Go to auction" : "Sign in"}
        </Link>
      </div>
    </main>
  );
}
