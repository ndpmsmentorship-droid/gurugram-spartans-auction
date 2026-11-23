import { getCurrentProfile } from "@/lib/auth";
import { loadOwnerPool } from "@/lib/auction/owner-pool";
import { ownTeam } from "@/lib/auction/owner-team";

// The owners' portal Live pool, refreshed by the browser every 30 s.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return Response.json({ error: "Please sign in." }, { status: 401 });
  const team = await ownTeam(profile);
  const pool = await loadOwnerPool({ teamId: team?.id ?? null });
  if (!pool) return Response.json({ error: "Couldn't load the pool." }, { status: 500 });
  return Response.json({ pool, team: team?.name ?? null, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
