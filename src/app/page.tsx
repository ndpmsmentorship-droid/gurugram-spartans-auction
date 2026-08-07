import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SpartansStars from "./SpartansStars";

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
    <main className="flex flex-1 flex-col">
      {/* hero */}
      <section className="mx-auto w-full max-w-3xl px-6 pt-24 pb-16 text-center">
        <p className="eyebrow inline-flex items-center gap-1.5">
          Gurugram Spartans <SpartansStars />
        </p>
        <h1 className="mt-3 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Scout smarter.
          <br />
          Build the squad.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted sm:text-xl">
          Upload the auction pool, rank every player on form-weighted batting,
          bowling, fielding and keeping — and buy with conviction.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/auction" className="btn-primary">
            Live auction board
          </Link>
          {profile ? (
            <>
              <Link href="/scout" className="btn-ghost">
                Scout pool
              </Link>
              <Link href="/squad" className="btn-ghost">
                Squad
              </Link>
              {profile.role === "admin" && (
                <Link href="/admin/auction" className="btn-ghost">
                  Admin console
                </Link>
              )}
              <Link href="/scout/import" className="btn-ghost">
                Import players
              </Link>
            </>
          ) : (
            <Link href="/login" className="btn-ghost">
              Sign in
            </Link>
          )}
        </div>
      </section>

      {/* stat tiles */}
      {profile && (
        <section className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-4 px-6 pb-24">
          <div className="rounded-[18px] bg-wash p-8 text-center">
            <p className="text-5xl font-semibold tracking-tight">{poolCount}</p>
            <p className="mt-2 text-sm text-muted">Players in the pool</p>
          </div>
          <div className="rounded-[18px] bg-wash p-8 text-center">
            <p className="text-5xl font-semibold tracking-tight text-accent-text">
              {boughtCount}
            </p>
            <p className="mt-2 text-sm text-muted">Bought</p>
          </div>
        </section>
      )}
    </main>
  );
}
