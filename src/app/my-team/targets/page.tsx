import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import TargetsList, { type PoolPlayer } from "./TargetsList";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function TargetsPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return <Shell><p className="text-muted">Please sign in.</p></Shell>;
  }

  const admin = createAdminClient();
  const sb = admin as unknown as { from: (t: string) => any };

  const { data: pool } = await sb
    .from("scout_players")
    .select("id, full_name, auction_category, primary_role, overall_index, photo_url, team_id");

  // rank the whole pool by overall index (1 = best)
  const rank = new Map<string, number>();
  ((pool ?? []) as any[])
    .filter((p) => p.overall_index != null)
    .sort((a, b) => b.overall_index - a.overall_index)
    .forEach((p, i) => rank.set(p.id, i + 1));

  // owner's existing marks (degrade gracefully if the table isn't set up yet)
  let markedIds = new Set<string>();
  let marksReady = true;
  try {
    const { data: marks, error } = await sb
      .from("player_marks")
      .select("player_id")
      .eq("marker_profile_id", profile.id);
    if (error) marksReady = false;
    else markedIds = new Set((marks ?? []).map((m: any) => m.player_id));
  } catch {
    marksReady = false;
  }

  const players: PoolPlayer[] = ((pool ?? []) as any[])
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      auction_category: p.auction_category,
      primary_role: p.primary_role,
      overall_rank: rank.get(p.id) ?? null,
      photo_url: p.photo_url ?? null,
      sold: p.team_id != null,
      marked: markedIds.has(p.id),
    }))
    .sort((a, b) => (a.overall_rank ?? 1e9) - (b.overall_rank ?? 1e9));

  return (
    <Shell>
      <p className="eyebrow">My Squad</p>
      <h1 className="mt-2 font-display text-2xl font-bold">Targets</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Mark the players you want. Your marked players appear in the{" "}
        <span className="num">Marked players</span> section of your squad, so you can track your
        targets through the auction.
      </p>
      {!marksReady && (
        <p className="mt-3 rounded-[10px] border border-line bg-wash px-3 py-2 text-[0.8rem] text-muted">
          Marking isn&rsquo;t switched on yet — the admin needs to run{" "}
          <span className="num">supabase/player_marks.sql</span>.
        </p>
      )}
      <TargetsList players={players} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-7">{children}</div>;
}
