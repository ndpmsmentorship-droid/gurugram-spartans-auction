import { createClient } from "@/lib/supabase/server";
import { resolveCategory } from "@/lib/scout/category";
import { rankPlayers } from "@/lib/scout/ranks";
import type { ScoutPlayerRow } from "@/lib/supabase/types";
import SquadList, { type SquadPlayer } from "./SquadList";
import RetainedShowcase from "./RetainedShowcase";
import MarqueeCards, { type MarqueePlayer } from "./MarqueeCards";
import ClearPicksButton from "./ClearPicksButton";

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

  const players = error ? [] : ((data ?? []) as unknown as SquadPlayer[]);
  const totalSpent = players.reduce((sum, p) => sum + (p.bought_price ?? 0), 0);

  // Marquee ("must buy") targets, ranked against the whole pool (1 = best).
  // Guarded so the page still renders if the is_marquee column isn't there yet.
  const { data: poolData } = await supabase.from("scout_players").select("*");
  const pool = (poolData ?? []) as ScoutPlayerRow[];
  const rankMap = new Map(rankPlayers(pool).map((p) => [p.id, p.overall_rank]));
  const marquee: MarqueePlayer[] = pool
    .filter((p) => p.is_marquee)
    .sort((a, b) => (b.overall_index ?? -1) - (a.overall_index ?? -1))
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      category: resolveCategory(p).category,
      primary_role: p.primary_role,
      overall_rank: rankMap.get(p.id) ?? null,
      photo_url: p.photo_url,
    }));

  const categoryById = new Map(pool.map((p) => [p.id, resolveCategory(p).category]));
  const signings = players.map((p) => ({
    id: p.id,
    name: p.full_name,
    role: p.primary_role,
    isKeeper: p.is_keeper,
    order: p.suggested_batting_order,
    price: p.bought_price,
    category: categoryById.get(p.id) ?? null,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
      <RetainedShowcase signings={signings} marquee={<MarqueeCards players={marquee} />} />

      <section className="mt-10 border-t border-border pt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Pseudo squad · mock buys</p>
            <h2 className="mt-1 font-display text-2xl font-bold">{players.length} bought</h2>
          </div>
          {players.length > 0 ? (
            <div className="flex items-center gap-4">
              <ClearPicksButton />
              <div className="text-right">
                <p className="eyebrow">Total spent</p>
                <p className="font-display text-2xl font-bold" style={{ color: "#D2451F" }}>
                  {totalSpent.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {players.length === 0 ? (
          <p className="mt-4 text-[0.9rem] text-muted">
            No mock buys yet. Go to the <strong>Pool</strong> and use <strong>⚡ Buy</strong> (or type a
            price) to dummy-buy players — they land here beside the retained core so you can see the
            squad take shape. Nothing here touches the live SCCL auction; hit <em>Clear all picks</em>{" "}
            to reset.
          </p>
        ) : (
          <>
            <p className="mt-1 text-[0.8rem] text-muted">
              Mock buys from the pool — a plan, not the live auction. Adjust prices with the typed Buy,
              or reset with Clear all picks.
            </p>
            <SquadList players={players} />
          </>
        )}
      </section>
    </main>
  );
}
