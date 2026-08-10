import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getActiveSeason } from "@/lib/auth";
import { resolveCategory } from "@/lib/scout/category";
import { rankPlayers } from "@/lib/scout/ranks";
import type { ScoutPlayerRow } from "@/lib/supabase/types";
import { type SquadPlayer } from "./SquadList";
import RetainedShowcase from "./RetainedShowcase";
import MarqueeCards, { type MarqueePlayer } from "./MarqueeCards";
import PositionTargets, { type SquadSlotPlayer } from "./PositionTargets";

export default async function SquadPage() {
  const supabase = await createClient();

  // Real Gurugram Spartans auction squad (team_id) + position-slot tags.
  const [profile, season] = await Promise.all([getCurrentProfile(), getActiveSeason()]);
  const isAdmin = profile?.role === "admin";
  let squad: SquadSlotPlayer[] = [];
  if (season) {
    // team_id / squad_slot aren't in the generated types — use a loose client.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as unknown as { from: (t: string) => any };
    const { data: sp } = await sb
      .from("teams")
      .select("id")
      .eq("season_id", season.id)
      .eq("name", "Gurugram Spartans")
      .maybeSingle();
    if (sp) {
      const cols = "id, full_name, primary_role, is_keeper, auction_category, acquired, sold_price";
      // squad_slot may not exist yet (pre-migration) — fall back gracefully.
      let res = await sb
        .from("scout_players")
        .select(`${cols}, squad_slot`)
        .eq("team_id", sp.id)
        .order("sold_price", { ascending: false, nullsFirst: false });
      if (res.error) {
        res = await sb
          .from("scout_players")
          .select(cols)
          .eq("team_id", sp.id)
          .order("sold_price", { ascending: false, nullsFirst: false });
      }
      squad = ((res.data ?? []) as SquadSlotPlayer[]).map((r) => ({
        ...r,
        squad_slot: r.squad_slot ?? null,
      }));
    }
  }
  const { data, error } = await supabase
    .from("scout_players")
    .select(
      "id, full_name, primary_role, auction_category, is_keeper, bought_price, utility_tag, " +
        "suggested_batting_order, bat_index, bowl_index, field_index, keep_index"
    )
    .eq("is_bought", true)
    .order("suggested_batting_order", { ascending: true, nullsFirst: false });

  const players = error ? [] : ((data ?? []) as unknown as SquadPlayer[]);

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
      auction_category: p.auction_category,
      batting_style: p.batting_style,
      bowling_style: p.bowling_style,
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
    tier: p.auction_category,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-5">
      <PositionTargets players={squad} isAdmin={isAdmin} />

      <div className="mt-10 border-t border-border pt-8">
        <RetainedShowcase signings={signings} marquee={<MarqueeCards players={marquee} />} />
      </div>
    </main>
  );
}
