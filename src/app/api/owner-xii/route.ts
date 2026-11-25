import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// An owner's wishlist playing XII (Plan tab, DreamXII.tsx), kept on the server so the same XII
// shows on the owner's phone and laptop (Nikhil, 25 Nov 2026). One small JSON file per login and
// team in the private Storage bucket "owner-plans" — no table needed; only this route reads it.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "owner-plans";
const SLOTS = 18; // playing XII + 6 bench (older saves had 12)
const teamKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60) || "team";
const pathOf = (profileId: string, team: string) => `xii/${profileId}/${teamKey(team)}.json`;

export async function GET(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return Response.json({ error: "Please sign in." }, { status: 401 });
  const team = new URL(req.url).searchParams.get("team") ?? "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;
  const { data, error } = await Promise.resolve()
    .then(() => sb.storage.from(BUCKET).download(pathOf(profile.id, team)))
    .catch(() => ({ data: null, error: true }));
  if (error || !data) return Response.json({ slots: null, at: null }, { headers: { "Cache-Control": "no-store" } });
  const j = JSON.parse(await (data as Blob).text().catch(() => "null")) as { slots?: unknown; at?: string } | null;
  return Response.json({ slots: Array.isArray(j?.slots) ? j!.slots : null, at: j?.at ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return Response.json({ error: "Please sign in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { team?: string; slots?: unknown } | null;
  const team = String(body?.team ?? "");
  const raw = body?.slots;
  if (!team || !Array.isArray(raw) || (raw.length !== SLOTS && raw.length !== 12)) return Response.json({ error: "Bad XII." }, { status: 400 });
  const slots = Array.from({ length: SLOTS }, (_, i) => raw[i]).map((x) => (typeof x === "string" && /^[\w:-]{1,80}$/.test(x) ? x : null));
  const at = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;
  const { error } = await Promise.resolve()
    .then(() =>
      sb.storage
        .from(BUCKET)
        .upload(pathOf(profile.id, team), new Blob([JSON.stringify({ slots, at })], { type: "application/json" }), { upsert: true, contentType: "application/json" }),
    )
    .catch(() => ({ error: true }));
  if (error) return Response.json({ error: "Couldn't save your XII. Please try again." }, { status: 500 });
  return Response.json({ ok: true, at });
}
