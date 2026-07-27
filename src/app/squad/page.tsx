import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SquadList, { type SquadPlayer } from "./SquadList";

export default async function SquadPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scout_players")
    .select(
      "id, full_name, primary_role, is_keeper, bought_price, utility_tag, " +
        "suggested_batting_order, bat_index, bowl_index, field_index, keep_index"
    )
    .eq("is_bought", true)
    .order("suggested_batting_order", { ascending: true, nullsFirst: false });

  if (error) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
        <p className="text-down">Failed to load squad: {error.message}</p>
      </main>
    );
  }

  const players = (data ?? []) as unknown as SquadPlayer[];
  const totalSpent = players.reduce((sum, p) => sum + (p.bought_price ?? 0), 0);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Our squad</p>
          <h1 className="mt-1 font-display text-2xl font-bold">
            {players.length} players
          </h1>
        </div>
        <div className="text-right">
          <p className="eyebrow">Total spent</p>
          <p className="font-display text-2xl font-bold text-accent-text">
            {totalSpent.toLocaleString()}
          </p>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-muted">No players bought yet.</p>
          <Link href="/scout" className="btn-primary mt-4 inline-block">
            Go to the pool
          </Link>
        </div>
      ) : (
        <SquadList players={players} />
      )}
    </main>
  );
}
