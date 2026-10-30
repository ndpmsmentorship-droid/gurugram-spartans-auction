import { getCurrentProfile } from "@/lib/auth";
import { loadOwnerPool } from "@/lib/auction/owner-pool";

// The owners' portal Live pool, refreshed by the browser every 30 s.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return Response.json({ error: "Please sign in." }, { status: 401 });
  const pool = await loadOwnerPool();
  if (!pool) return Response.json({ error: "Couldn't load the pool." }, { status: 500 });
  return Response.json({ pool, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
