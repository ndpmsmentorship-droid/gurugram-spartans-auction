import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuctionSeasonId, AUCTION_DIVISIONS } from "@/lib/auction/target";
import { readLiveLot } from "@/lib/auction/read";
import { LEAGUE_NAME, LEAGUE } from "@/lib/league";
import { type WRPlayer, type WRTeam } from "./WarRoom";
import OwnerPortal, { type PortalTab } from "./OwnerPortal";
import { selectAll } from "@/lib/supabase/select-all";

export const metadata: Metadata = { title: "War Room" };
export const dynamic = "force-dynamic";

// The owners' portal, one page: Plan (squad strategies), Live pool (Season 2
// registrations as they're vetted) and the War Room for auction night — purse,
// category slots, squad gaps, the player on the block and who can still afford
// him. Everything after this first load is computed in the browser, and sales
// arrive over realtime — no reloads mid-auction.
export default async function WarRoomPage({ searchParams }: { searchParams: Promise<{ team?: string; tab?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/war-room");
  const { team: teamParam, tab } = await searchParams;

  const seasonId = await getAuctionSeasonId();
  const sb = createAdminClient() as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

  const [{ data: teams }, { data: pool }, lot] = await Promise.all([
    sb.from("teams").select("id, name, purse_total, purse_max, owner_profile_id, logo_url").eq("season_id", seasonId).in("division", AUCTION_DIVISIONS).order("name"),
    selectAll(sb, "scout_players", "id, full_name, photo_url, age, primary_role, batting_style, bowling_style, is_keeper, auction_category, bat_matches, runs, bat_avg, bat_sr, wickets, economy, bowl_sr, bat_index, bowl_index, overall_index, team_id, sold_price, acquired, rtm_against, is_rejected"),
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

  const players = ((pool ?? []) as WRPlayer[]).filter((p) => !p.is_rejected);
  return (
    <OwnerPortal
      tab={(["plan", "pool", "live"] as PortalTab[]).includes(tab as PortalTab) ? (tab as PortalTab) : "live"}
      warRoom={{
        league: LEAGUE,
        leagueName: LEAGUE_NAME[LEAGUE],
        seasonId: seasonId ?? "",
        myTeamId: mine.id,
        canSwitch: profile.role === "admin",
        profileId: profile.id,
        canRecord: profile.role === "admin",
        teams: list.map(({ id, name, purse_total, purse_max, logo_url }) => ({ id, name, purse_total, purse_max, logo_url })),
        players,
        initialLot: { player_id: lot.status === "live" ? lot.player_id : null, current_bid: lot.current_bid, base_price: lot.base_price, leading_team_id: lot.leading_team_id },
      }}
      plan={{
        seasonId: seasonId ?? "",
        profileId: profile.id,
        team: { id: mine.id, name: mine.name, purse_total: mine.purse_total, purse_max: mine.purse_max ?? null },
        players,
      }}
    />
  );
}
