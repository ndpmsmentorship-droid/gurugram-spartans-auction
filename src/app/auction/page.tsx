import { createAdminClient } from "@/lib/supabase/admin";
import SquadsBoard, { type BoardPlayer, type BoardTeam } from "./SquadsBoard";

export const dynamic = "force-dynamic";

// Public live board — read with the service-role client so anyone (no login) can
// watch. Read-only; only non-sensitive auction results (teams, sold players).
export default async function AuctionPage() {
  const admin = createAdminClient();
  const sb = admin as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: season } = await admin.from("seasons").select("id").eq("is_active", true).maybeSingle();
  if (!season) {
    return <p className="p-6 text-muted">No active season yet.</p>;
  }

  const [{ data: teams }, { data: players }] = await Promise.all([
    sb.from("teams").select("id, name, division, purse_total").eq("season_id", season.id).order("name"),
    sb
      .from("scout_players")
      .select("id, full_name, auction_category, team_id, sold_price, acquired")
      .not("team_id", "is", null),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
      <SquadsBoard teams={(teams ?? []) as BoardTeam[]} players={(players ?? []) as BoardPlayer[]} />
    </div>
  );
}
