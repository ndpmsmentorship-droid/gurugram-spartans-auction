import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownTeam } from "@/lib/auction/owner-team";

// An owner recommends (or withdraws a recommendation for) a player whose corporate profiling asked for a
// franchise owner's recommendation (Nikhil, 23 Nov 2026). One per team per player; the league admin sees
// them on playfulventures.co.in/admin and still decides. Table: playful-site supabase/registration_v8.sql.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  const team = await ownTeam(profile);
  if (!profile || !team) return Response.json({ error: "Only a franchise owner can recommend a player." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { id?: string; on?: boolean; note?: string } | null;
  const id = String(body?.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Unknown player." }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;
  if (body?.on === false) {
    const { error } = await sb.from("owner_recommendations").delete().eq("registration_id", id).eq("team_id", team.id);
    if (error) return Response.json({ error: "Couldn't withdraw it. Please try again." }, { status: 500 });
    return Response.json({ ok: true, on: false });
  }
  const { data: reg } = await sb.from("registrations").select("status").eq("id", id).maybeSingle();
  if (reg?.status !== "under_review") return Response.json({ error: "This player doesn't need a recommendation." }, { status: 409 });
  const note = String(body?.note ?? "").trim().slice(0, 300) || null;
  const { error } = await sb
    .from("owner_recommendations")
    .upsert({ registration_id: id, team_id: team.id, team_name: team.name, profile_id: profile.id, note }, { onConflict: "registration_id,team_id" });
  if (error) return Response.json({ error: "Couldn't save the recommendation. Please try again." }, { status: 500 });
  return Response.json({ ok: true, on: true });
}
