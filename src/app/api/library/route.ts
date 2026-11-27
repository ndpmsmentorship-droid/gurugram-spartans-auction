import { createHmac } from "node:crypto";
import { getCurrentProfile } from "@/lib/auth";
import { ownTeam } from "@/lib/auction/owner-team";

// "Ball Library" on the owners' portal (Nikhil, 27 Nov 2026): a signed-in owner (or the league admin)
// goes to the ball library on ndpms.in already signed in, with full access — no second login.
// A 5-minute token signed with SLL_OWNER_SSO_SECRET (same value on the LMS project), read by
// ndpms.in/api/spartans/owner-sso, which issues the library's own pass and cookie.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIBRARY = "https://www.ndpms.in";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return Response.redirect(`${LIBRARY}/spartans?from=owners`, 303);
  const secret = process.env.SLL_OWNER_SSO_SECRET;
  if (!secret || (profile.role !== "owner" && profile.role !== "admin")) return Response.redirect(`${LIBRARY}/spartans?from=owners`, 303);
  const team = await ownTeam(profile);
  const payload = {
    u: profile.id,
    n: (profile as { display_name?: string | null }).display_name || team?.name || "SLL owner",
    tm: team?.name ?? null,
    e: Math.floor(Date.now() / 1000) + 300,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  return new Response(null, { status: 303, headers: { location: `${LIBRARY}/api/spartans/owner-sso?t=${body}.${sig}`, "cache-control": "no-store" } });
}
