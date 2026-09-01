"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type TeamsActionState = { error?: string; ok?: string } | null;

const LOGO_BUCKET = "team-logos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

async function assertAdmin(): Promise<boolean> {
  const p = await getCurrentProfile();
  return !!p && p.role === "admin";
}

/**
 * Every surface that shows a team reads it from the `teams` row, so one
 * revalidation sweep covers the lot. Listed explicitly rather than wildcarded
 * so it's obvious what depends on this table.
 */
function refresh() {
  for (const path of [
    "/admin/teams",
    "/admin/owners",
    "/admin/schedule",
    "/schedule",
    "/auction",
    "/squad",
    "/my-team",
    "/team",
    "/players",
  ]) {
    revalidatePath(path);
  }
}

async function activeSeasonId(
  admin: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  const { data } = await admin
    .from("seasons")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return data?.id ?? null;
}

/** Rename a team, move it between groups, and/or replace its logo. */
export async function saveTeam(
  _prev: TeamsActionState,
  form: FormData
): Promise<TeamsActionState> {
  if (!(await assertAdmin())) return { error: "Not authorized." };

  const teamId = String(form.get("teamId") || "");
  const name = String(form.get("name") || "").trim();
  const group = String(form.get("group") || "").trim();
  if (!teamId) return { error: "Missing team." };
  if (!name) return { error: "Team name cannot be empty." };
  if (name.length > 60) return { error: "Team name is too long (max 60)." };
  if (!group) return { error: "Pick a group." };

  const admin = createAdminClient();
  const seasonId = await activeSeasonId(admin);
  if (!seasonId) return { error: "No active season." };

  // Two teams sharing a name makes every squad/fixture list ambiguous.
  const { data: clash } = await admin
    .from("teams")
    .select("id")
    .eq("season_id", seasonId)
    .eq("name", name)
    .neq("id", teamId)
    .maybeSingle();
  if (clash) return { error: `Another team is already called "${name}".` };

  const update: {
    name: string;
    division: string;
    logo_url?: string;
    source_team_id: string | null;
  } = {
    name,
    division: group,
    // Prototype: which archived squad this team displays. Empty = its own.
    source_team_id: String(form.get("sourceTeamId") || "") || null,
  };

  const logo = form.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > MAX_LOGO_BYTES)
      return { error: "Logo must be 2 MB or smaller." };
    if (!LOGO_TYPES.includes(logo.type))
      return { error: "Logo must be a PNG, JPEG, WebP or SVG." };

    const ext = logo.type === "image/svg+xml" ? "svg" : logo.type.split("/")[1];
    const path = `${teamId}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(LOGO_BUCKET)
      .upload(path, logo, { upsert: true, contentType: logo.type });
    if (upErr) return { error: `Logo upload failed: ${upErr.message}` };

    const { data: pub } = admin.storage.from(LOGO_BUCKET).getPublicUrl(path);
    // Cache-bust: the path is stable per team, so a re-upload would otherwise
    // keep serving the old image from the CDN.
    update.logo_url = `${pub.publicUrl}?v=${Date.now()}`;
  }

  const { error } = await admin.from("teams").update(update).eq("id", teamId);
  if (error) return { error: error.message };

  refresh();
  return { ok: `Saved ${name}.` };
}

/** Drop a team's logo back to the lettered fallback. */
export async function clearLogo(
  _prev: TeamsActionState,
  form: FormData
): Promise<TeamsActionState> {
  if (!(await assertAdmin())) return { error: "Not authorized." };
  const teamId = String(form.get("teamId") || "");
  if (!teamId) return { error: "Missing team." };

  const admin = createAdminClient();
  // Remove every extension we might have written for this team.
  await admin.storage
    .from(LOGO_BUCKET)
    .remove(["png", "jpeg", "webp", "svg"].map((e) => `${teamId}.${e}`));

  const { error } = await admin
    .from("teams")
    .update({ logo_url: null })
    .eq("id", teamId);
  if (error) return { error: error.message };

  refresh();
  return { ok: "Logo removed." };
}

/** Add a franchise to the active season. */
export async function addTeam(
  _prev: TeamsActionState,
  form: FormData
): Promise<TeamsActionState> {
  if (!(await assertAdmin())) return { error: "Not authorized." };

  const name = String(form.get("name") || "").trim();
  const group = String(form.get("group") || "").trim();
  if (!name) return { error: "Team name is required." };
  if (!group) return { error: "Pick a group." };

  const admin = createAdminClient();
  const seasonId = await activeSeasonId(admin);
  if (!seasonId) return { error: "No active season." };

  const { data: clash } = await admin
    .from("teams")
    .select("id")
    .eq("season_id", seasonId)
    .eq("name", name)
    .maybeSingle();
  if (clash) return { error: `"${name}" already exists.` };

  // Mirror the purse the SDLL migration set, so a late addition starts level
  // with the eleven teams already in the auction.
  const { error } = await admin.from("teams").insert({
    season_id: seasonId,
    name,
    division: group,
    purse_total: 300000,
    purse_remaining: 300000,
    is_mock: false,
  });
  if (error) return { error: error.message };

  refresh();
  return { ok: `Added ${name}.` };
}

/**
 * Remove a franchise.
 *
 * Refuses while the team still holds players or appears in a fixture — those
 * FKs are ON DELETE SET NULL, so deleting anyway would quietly orphan a squad
 * and blank out fixtures rather than failing loudly.
 */
export async function removeTeam(
  _prev: TeamsActionState,
  form: FormData
): Promise<TeamsActionState> {
  if (!(await assertAdmin())) return { error: "Not authorized." };

  const teamId = String(form.get("teamId") || "");
  if (String(form.get("confirm")) !== "remove-team")
    return { error: "Removing a team needs an explicit confirmation." };

  const admin = createAdminClient();

  const sb = admin as unknown as { from: (t: string) => any };
  const { count: squad } = await sb
    .from("scout_players")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);
  if (squad && squad > 0)
    return {
      error: `That team still has ${squad} player${squad === 1 ? "" : "s"}. Release them first.`,
    };

  const { count: fixtures } = await admin
    .from("fixtures")
    .select("id", { count: "exact", head: true })
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);
  if (fixtures && fixtures > 0)
    return {
      error: `That team appears in ${fixtures} fixture${fixtures === 1 ? "" : "s"}. Clear or regenerate the schedule first.`,
    };

  await admin.storage
    .from(LOGO_BUCKET)
    .remove(["png", "jpeg", "webp", "svg"].map((e) => `${teamId}.${e}`));

  const { error } = await admin.from("teams").delete().eq("id", teamId);
  if (error) return { error: error.message };

  refresh();
  return { ok: "Team removed." };
}
