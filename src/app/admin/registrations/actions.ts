"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeAllIndices } from "@/lib/scout/recompute";
import { SEASON, BUCKET } from "@/app/register/shared";

// Review actions for /admin/registrations. Server actions are callable
// directly, so each one re-checks the admin role instead of relying on the
// admin layout's redirect.
async function adminId(): Promise<string | null> {
  const p = await getCurrentProfile();
  return p && p.role === "admin" ? p.id : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as unknown as { from: (t: string) => any };

async function update(id: string, patch: Record<string, unknown>) {
  const by = await adminId();
  if (!by || !id) return;
  await db()
    .from("registrations")
    .update({ ...patch, reviewed_by: by, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/registrations");
}

// LinkedIn check is manual: the admin opens the profile and ticks what they see.
// Fewer than 500 connections parks the player in "under review".
export async function markLinkedin(form: FormData) {
  const ok = form.get("verdict") === "yes";
  await update(String(form.get("id") || ""), ok
    ? { linkedin_verified: true }
    : { linkedin_verified: false, status: "under_review" });
}

// Approving someone whose LinkedIn hasn't been confirmed at 500+ lands them in
// "under review" instead, per the league rule.
export async function setStatus(form: FormData) {
  const id = String(form.get("id") || "");
  const status = String(form.get("status") || "");
  if (!["approved", "under_review", "rejected", "pending"].includes(status)) return;
  if (status === "approved") {
    const { data } = await db().from("registrations").select("linkedin_verified").eq("id", id).maybeSingle();
    if (!data?.linkedin_verified) return update(id, { status: "under_review" });
  }
  await update(id, { status });
}

// ---- Approved registration → auction pool --------------------------------
// The pool (scout_players) is what the auctioneer puts up and owners scout.
// A registration enters it as its own row keyed source_id = "reg:<id>", so a
// second click only updates the category. Players already in the pool from
// the league platform import are matched (CricHeroes id, then name) and not
// duplicated.

const PUBLIC_PHOTOS = "player-photos";
const CATEGORIES = ["A+", "A", "B", "Special"];

const BAT_STYLE: Record<string, string> = {
  "Left Hand Batsman": "Left-hand bat",
  "Right Hand Batsman": "Right-hand bat",
};
const BOWL_STYLE: Record<string, string> = {
  "Left Arm Pacer": "Left-arm medium",
  "Left Arm Spinner": "Left-arm orthodox",
  "Right Arm Pacer": "Right-arm medium",
  "Right Arm Spin": "Right-arm off-break",
};

const chId = (link: string | null | undefined) =>
  link?.match(/player-profile\/(\d+)/)?.[1] ?? link?.match(/\/(\d{4,})(?:\/|$)/)?.[1] ?? null;
const nameKey = (n: string | null | undefined) => (n ?? "").toLowerCase().replace(/\s+/g, " ").trim();

// SARDA-era master rows say "ALL_ROUNDER"; the pool uses "All-Rounder".
const ROLE_NAMES: Record<string, string> = {
  ALL_ROUNDER: "All-Rounder",
  BATSMAN: "Batsman",
  BATTER: "Batsman",
  BOWLER: "Bowler",
  WICKET_KEEPER: "Wicket-Keeper",
};
const poolRole = (role: string | null | undefined) =>
  role ? ROLE_NAMES[role.toUpperCase().replace(/[\s-]+/g, "_")] ?? role : null;
const isImage = (url: string | null | undefined) => !!url && !/\.pdf($|\?)/i.test(url);

function roleOf(r: Record<string, unknown>): string {
  if (r.allrounder) return "All-Rounder";
  if (r.is_keeper) return "Wicket-Keeper";
  return r.bowling_type && !r.batting_hand ? "Bowler" : r.bowling_type ? "All-Rounder" : "Batsman";
}

// New players' photos sit in the private bucket; the pool needs a public URL,
// so the photo is copied once into a public bucket.
async function publicPhoto(sb: ReturnType<typeof createAdminClient>, path: string): Promise<string | null> {
  const store = sb.storage;
  const { data: buckets } = await store.listBuckets();
  if (!buckets?.some((b) => b.name === PUBLIC_PHOTOS)) {
    await store.createBucket(PUBLIC_PHOTOS, { public: true });
  }
  const { data: file } = await store.from(BUCKET).download(path);
  if (!file) return null;
  const dest = `${SEASON}/${path.split("/").slice(-2).join("-")}`;
  const { error } = await store.from(PUBLIC_PHOTOS).upload(dest, file, { upsert: true, contentType: file.type || "image/jpeg" });
  if (error) return null;
  return store.from(PUBLIC_PHOTOS).getPublicUrl(dest).data.publicUrl;
}

async function addOne(regId: string, category: string | null): Promise<void> {
  const sb = createAdminClient();
  const t = db();
  const { data: r } = await t.from("registrations").select("*").eq("id", regId).maybeSingle();
  if (!r || r.status !== "approved") return;
  const { data: m } = r.master_id
    ? await t.from("player_master").select("*").eq("id", r.master_id).maybeSingle()
    : { data: null };
  // Past-season labels (e.g. "U35B") aren't auction categories; only keep a valid one.
  const valid = (c: string | null | undefined) => (c && CATEGORIES.includes(c) ? c : null);
  const cat = valid(category) ?? valid(m?.category);
  const sourceId = `reg:${r.id}`;

  const { data: mine } = await t.from("scout_players").select("id").eq("source_id", sourceId).maybeSingle();
  if (mine) {
    await t.from("scout_players").update({ auction_category: cat }).eq("id", mine.id);
    return;
  }

  // Already in the pool from the league platform? Link, don't duplicate.
  const { data: pool } = await t.from("scout_players").select("id, full_name, cricheroes_link, auction_category");
  const ch = chId(r.cricheroes_link ?? m?.cricheroes_link);
  const same = (pool ?? []).find(
    (p: Record<string, string | null>) =>
      (ch && chId(p.cricheroes_link) === ch) || nameKey(p.full_name) === nameKey(r.full_name),
  );
  if (same) {
    if (!same.auction_category && cat) await t.from("scout_players").update({ auction_category: cat }).eq("id", same.id);
    return;
  }

  const s = (m?.stats ?? {}) as Record<string, number | string>;
  const n = (k: string) => (s[k] === undefined || s[k] === null || s[k] === "" ? null : Number(s[k]));
  const dobAge = r.dob ? Math.floor((Date.now() - new Date(r.dob).getTime()) / (365.25 * 864e5)) : null;
  // The photo they just uploaded is the freshest; else the one on file.
  const photo = (r.photo_path ? await publicPhoto(sb, r.photo_path) : null) ?? (isImage(m?.photo_url) ? m.photo_url : null);

  const { error } = await t.from("scout_players").insert({
    source_id: sourceId,
    full_name: r.full_name,
    age: dobAge,
    phone: r.phone,
    email: r.email,
    photo_url: photo,
    cricheroes_link: r.cricheroes_link ?? m?.cricheroes_link ?? null,
    primary_role: poolRole(m?.primary_role) ?? roleOf(r),
    batting_style: m?.batting_style ?? BAT_STYLE[r.batting_hand] ?? null,
    bowling_style: m?.bowling_style ?? BOWL_STYLE[r.bowling_type] ?? null,
    is_keeper: !!r.is_keeper,
    auction_category: cat,
    reg_status: "verified",
    bat_matches: n("matches"),
    runs: n("runs"),
    highest_score: s.highest != null ? String(s.highest) : null,
    bat_avg: n("bat_avg"),
    bat_sr: n("bat_sr"),
    fifties: n("fifties"),
    wickets: n("wickets"),
    economy: n("economy"),
    bowl_avg: n("bowl_avg"),
    catches: n("catches"),
  });
  if (error) throw new Error(error.message);
}

async function afterPoolChange() {
  await recomputeAllIndices();
  revalidatePath("/admin/registrations");
  revalidatePath("/scout");
}

export async function addToPool(form: FormData) {
  if (!(await adminId())) return;
  await addOne(String(form.get("id") || ""), String(form.get("category") || "") || null);
  await afterPoolChange();
}

// One click for everyone approved who isn't in the pool yet.
export async function addAllApprovedToPool() {
  if (!(await adminId())) return;
  const t = db();
  const { data: regs } = await t.from("registrations").select("id").eq("season", SEASON).eq("status", "approved");
  const ids = (regs ?? []).map((x: { id: string }) => x.id);
  if (!ids.length) return;
  const { data: have } = await t.from("scout_players").select("source_id").in("source_id", ids.map((i: string) => `reg:${i}`));
  const done = new Set((have ?? []).map((h: { source_id: string }) => h.source_id));
  for (const id of ids) if (!done.has(`reg:${id}`)) await addOne(id, null);
  await afterPoolChange();
}

// Undo, only while the player is unsold.
export async function removeFromPool(form: FormData) {
  if (!(await adminId())) return;
  const id = String(form.get("id") || "");
  await db().from("scout_players").delete().eq("source_id", `reg:${id}`).is("team_id", null);
  await afterPoolChange();
}
