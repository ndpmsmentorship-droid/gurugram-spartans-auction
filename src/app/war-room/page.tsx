import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuctionSeasonId, AUCTION_DIVISIONS } from "@/lib/auction/target";
import { readLiveLot } from "@/lib/auction/read";
import { LEAGUE_NAME, LEAGUE } from "@/lib/league";
import WarRoom, { type WRPlayer, type WRTeam } from "./WarRoom";

export const metadata: Metadata = { title: "War Room" };
export const dynamic = "force-dynamic";

// One screen for an owner during a live auction: purse, category slots, squad
// gaps with the best available fits, the player on the block and who can
// still afford him. Everything after this first load is computed in the
// browser, and sales arrive over realtime — no reloads mid-auction.
export default async function WarRoomPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/war-room");
  const { team: teamParam } = await searchParams;

  const seasonId = await getAuctionSeasonId();
  const sb = createAdminClient() as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

  const [{ data: teams }, { data: pool }, lot] = await Promise.all([
    sb.from("teams").select("id, name, purse_total, owner_profile_id").eq("season_id", seasonId).in("division", AUCTION_DIVISIONS).order("name"),
    sb.from("scout_players")
      .select("id, full_name, photo_url, age, primary_role, batting_style, bowling_style, is_keeper, auction_category, bat_matches, runs, bat_avg, bat_sr, wickets, economy, bowl_sr, bat_index, bowl_index, overall_index, team_id, sold_price, acquired, rtm_against, is_rejected")
      .limit(2000),
    readLiveLot(seasonId),
  ]);

  const list = (teams ?? []) as (WRTeam & { owner_profile_id: string | null })[];
  // Owners see their own team; admins can look at any (?team=<name>),
  // defaulting to Gurugram Spartans.
  const mine =
    (profile.role === "owner" ? list.find((t) => t.owner_profile_id === profile.id) : null) ??
    list.find((t) => t.name === teamParam) ??
    list.find((t) => /spartans/i.test(t.name)) ??
    list[0];
  if (!mine) {
    return <main className="mx-auto max-w-[900px] px-4 py-16 text-muted">No teams in the active season yet.</main>;
  }

  return (
    <WarRoom
      league={LEAGUE}
      leagueName={LEAGUE_NAME[LEAGUE]}
      seasonId={seasonId ?? ""}
      myTeamId={mine.id}
      canSwitch={profile.role === "admin"}
      canRecord={profile.role === "admin" || (profile.role === "owner" && LEAGUE === "uscl")}
      teams={list.map(({ id, name, purse_total }) => ({ id, name, purse_total }))}
      players={((pool ?? []) as WRPlayer[]).filter((p) => !p.is_rejected)}
      initialLot={{ player_id: lot.status === "live" ? lot.player_id : null, current_bid: lot.current_bid, base_price: lot.base_price, leading_team_id: lot.leading_team_id }}
    />
  );
}
