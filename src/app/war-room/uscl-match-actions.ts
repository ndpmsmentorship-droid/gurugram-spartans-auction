"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";

// "Match with USCL" (admin only). The War Room can't sign in to the USCL site
// itself — the franchise password never goes onto this server. Instead the
// button drops a request into the private `ops` bucket; the checker running on
// Nikhil's Mac (scripts/uscl-match-watch.mjs) sees it, runs the read-only fetch +
// reconcile, applies the safe fixes and writes the report back here.
const BUCKET = "ops";
const REQ = "uscl-match/request.json";
const REP = "uscl-match/report.json";

export type MatchReport = { at: string; ok: boolean; summary: string; text: string; requestedAt?: string; running?: string };
export type MatchState = { requestedAt: string | null; report: MatchReport | null; checkerSeen: string | null };

async function isAdmin() {
  return (await getCurrentProfile())?.role === "admin";
}

async function readJson<T>(path: string): Promise<T | null> {
  const { data } = await createAdminClient().storage.from(BUCKET).download(path);
  if (!data) return null;
  try { return JSON.parse(await data.text()) as T; } catch { return null; }
}

export async function requestUsclMatch(): Promise<{ error?: string; requestedAt?: string }> {
  if (!(await isAdmin())) return { error: "Admins only." };
  const requestedAt = new Date().toISOString();
  const { error } = await createAdminClient().storage.from(BUCKET)
    .upload(REQ, JSON.stringify({ requestedAt }), { upsert: true, contentType: "application/json" });
  return error ? { error: error.message } : { requestedAt };
}

export async function readUsclMatch(): Promise<MatchState | { error: string }> {
  if (!(await isAdmin())) return { error: "Admins only." };
  const [req, report, beat] = await Promise.all([
    readJson<{ requestedAt: string }>(REQ),
    readJson<MatchReport>(REP),
    readJson<{ at: string }>("uscl-match/heartbeat.json"),
  ]);
  return { requestedAt: req?.requestedAt ?? null, report, checkerSeen: beat?.at ?? null };
}
