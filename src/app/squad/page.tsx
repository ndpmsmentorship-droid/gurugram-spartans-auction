import { createClient } from "@/lib/supabase/server";
import { resolveCategory } from "@/lib/scout/category";
import type { ScoutPlayerRow } from "@/lib/supabase/types";
import SquadList, { type SquadPlayer } from "./SquadList";
import RetainedShowcase from "./RetainedShowcase";
import MarqueeCards, { type MarqueePlayer } from "./MarqueeCards";

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

  // Marquee ("must buy") targets flagged from the pool. Guarded so the page
  // still renders if the is_marquee column hasn't been added yet.
  const { data: mData, error: mError } = await supabase
    .from("scout_players")
    .select("*")
    .eq("is_marquee", true)
    .order("overall_index", { ascending: false, nullsFirst: false });
  const marquee: MarqueePlayer[] =
    mError || !mData
      ? []
      : (mData as ScoutPlayerRow[]).map((p) => ({
          id: p.id,
          full_name: p.full_name,
          category: resolveCategory(p).category,
          overall_index: p.overall_index,
          photo_url: p.photo_url,
        }));

  const signings = players.map((p) => ({
    id: p.id,
    name: p.full_name,
    role: p.primary_role,
    isKeeper: p.is_keeper,
    order: p.suggested_batting_order,
    price: p.bought_price,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
      <RetainedShowcase signings={signings} />

      <MarqueeCards players={marquee} />

      <section className="mt-10 border-t border-border pt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Auction signings</p>
            <h2 className="mt-1 font-display text-2xl font-bold">{players.length} bought</h2>
          </div>
          {players.length > 0 ? (
            <div className="text-right">
              <p className="eyebrow">Total spent</p>
              <p className="font-display text-2xl font-bold" style={{ color: "#D2451F" }}>
                {totalSpent.toLocaleString("en-IN")}
              </p>
            </div>
          ) : null}
        </div>

        {players.length === 0 ? (
          <p className="mt-4 text-[0.9rem] text-muted">
            No players bought yet — signings from the season-6 auction will appear here alongside the
            retained core above.
          </p>
        ) : (
          <SquadList players={players} />
        )}
      </section>
    </main>
  );
}
