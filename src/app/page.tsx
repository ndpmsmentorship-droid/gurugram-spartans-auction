import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const profile = await getCurrentProfile();

  let poolCount = 0;
  let boughtCount = 0;
  if (profile) {
    const supabase = await createClient();
    const [{ count: total }, { count: bought }] = await Promise.all([
      supabase.from("scout_players").select("id", { count: "exact", head: true }),
      supabase
        .from("scout_players")
        .select("id", { count: "exact", head: true })
        .eq("is_bought", true),
    ]);
    poolCount = total ?? 0;
    boughtCount = bought ?? 0;
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-16">
      <p className="eyebrow">Gurugram Spartans · Auction Day</p>
      <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
        Scout smarter. Bid sharper. Build the squad.
      </h1>
      <p className="mt-4 max-w-xl text-[1.05rem] text-muted">
        Upload the auction pool, rank every player by batting, bowling, fielding
        and keeping index, and mark who you buy — the squad builds itself.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        {profile ? (
          <>
            <Link href="/scout" className="btn-primary">
              Open the pool
            </Link>
            <Link href="/scout/import" className="btn-ghost">
              Import players
            </Link>
          </>
        ) : (
          <Link href="/login" className="btn-primary">
            Sign in to start
          </Link>
        )}
      </div>

      {profile && (
        <div className="mt-12 grid max-w-md grid-cols-2 gap-4">
          <div className="card">
            <p className="eyebrow">In the pool</p>
            <p className="mt-1 font-display text-3xl font-bold">{poolCount}</p>
          </div>
          <div className="card">
            <p className="eyebrow">Bought</p>
            <p className="mt-1 font-display text-3xl font-bold text-accent-text">
              {boughtCount}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
