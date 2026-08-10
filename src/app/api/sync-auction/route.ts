import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Mirror the live auction from the SCCL dashboard (anantanity) into our board:
// every team assignment + price. Anantanity is the source of truth. Called from
// the browser every ~5 min while a tab is open; a 60s module guard stops hammering.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE = process.env.SCCL_BASE_URL || "https://sarda-corporate-league.anantanity.com";
const SEASON = Number(process.env.SCCL_SEASON) || 6;
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

let lastSyncAt = 0; // per warm-instance soft rate limit

/* eslint-disable @typescript-eslint/no-explicit-any */
async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: process.env.SCCL_USERNAME, password: process.env.SCCL_PASSWORD }),
    cache: "no-store",
  });
  const j = await res.json().catch(() => null);
  const t = j?.data?.token?.token;
  if (!t) throw new Error("SCCL login failed");
  return t;
}

async function fetchAll(token: string): Promise<any[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const out: any[] = [];
  let page = 1;
  for (;;) {
    const r = await fetch(`${BASE}/api/players?limit=100&page=${page}&season=${SEASON}`, { headers, cache: "no-store" });
    const j = await r.json();
    const d = j?.data;
    const rows: any[] = Array.isArray(d) ? d : (d?.players ?? []);
    out.push(...rows);
    if (page >= (j?.totalPages ?? 1)) break;
    page++;
  }
  return out;
}

export async function GET() {
  // Auction is over and the squad is curated manually — the mirror is disabled so
  // it can't overwrite manual edits. Re-enable by removing this guard if needed.
  return NextResponse.json({ ok: true, disabled: true, note: "sync disabled post-auction" });

  // eslint-disable-next-line no-unreachable
  const now = Date.now();
  if (now - lastSyncAt < 60_000) {
    return NextResponse.json({ skipped: true, reason: "synced <60s ago" });
  }
  try {
    const admin = createAdminClient() as any;
    const { data: season } = await admin.from("seasons").select("id").eq("is_active", true).maybeSingle();
    if (!season) return NextResponse.json({ ok: false, error: "no active season" }, { status: 400 });

    const { data: teams } = await admin.from("teams").select("id, name").eq("season_id", season.id);
    const teamByName = new Map<string, string>();
    for (const t of teams ?? []) teamByName.set(norm(t.name), t.id);

    const { data: mine } = await admin
      .from("scout_players")
      .select("id, full_name, team_id, sold_price, acquired");
    const byName = new Map<string, any>();
    for (const p of mine ?? []) if (!byName.has(norm(p.full_name))) byName.set(norm(p.full_name), p);

    const rows = await fetchAll(await login());
    const assigned = new Set<string>();
    let updated = 0;

    for (const r of rows) {
      const tid = r.teamBought ? teamByName.get(norm(r.teamBought)) : null;
      if (!tid) continue;
      const acquired = r.isOwner ? "owner" : r.isRetained ? "retained" : r.auctionStatus === "sold" ? "auction" : null;
      if (!acquired) continue;
      const price = Number(r.priceBought ?? r.soldPrice) || null;
      const key = norm(r.Name);
      assigned.add(key);
      const p = byName.get(key);
      if (!p) continue;
      if (p.team_id !== tid || Number(p.sold_price) !== Number(price) || p.acquired !== acquired) {
        await admin.from("scout_players").update({ team_id: tid, sold_price: price, acquired }).eq("id", p.id);
        updated++;
      }
    }

    // Additive mirror only: we never un-assign here, so manual squad additions
    // (players won but not yet reflected on Anantanity) are preserved.
    const cleared = 0;

    lastSyncAt = now;
    return NextResponse.json({ ok: true, updated, cleared, players: rows.length, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
