import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// The live player pool for the owners' portal: every Season 2 registration as
// it comes in, grouped Selected / Under review / Rejected from the league's
// vetting. Owners see cricket and work details only — never phone, email, date
// of birth, Aadhaar, fee or vetting notes.
// The same four stages as the league admin (playful-site src/app/admin/stage.ts, 20 Nov 2026 — change both
// together), so owners watch every registration move: new → one check done → in the pool. Two checks: the
// fee (accounts) and corporate profiling (LinkedIn 500+ / under 500 vetted; or a franchise owner's
// recommendation required; or rejected). Owners see the stage only, never the fee amount or UPI reference.
export type PoolStatus = "new" | "fee_pending" | "profiling_pending" | "pool" | "rejected";
export type PoolEntry = {
  id: string;
  name: string;
  status: PoolStatus;
  recommend: boolean; // corporate profiling asked for a franchise owner's recommendation
  returning: boolean;
  role: string;
  employer: string | null;
  designation: string | null;
  photo: string | null;
  lastTeam: string | null; // Season 1 team, for returning players
  hasData: boolean; // match stats on record
  // CricHeroes career headline (player_master.stats). Cricket numbers only.
  stats: { m: number | null; runs: number | null; avg: number | null; sr: number | null; hs: string | null; wk: number | null; econ: number | null; best: string | null } | null;
  checkedOn: string | null; // ISO date the league team last entered them from CricHeroes
  at: string; // registered
};

const SEASON = "SDLL-S2";
function stageOf(r: { status: string; fee_status: string | null; linkedin_verified: boolean | null }): PoolStatus {
  if (r.status === "rejected") return "rejected";
  if (r.status === "approved") return "pool";
  const fee = r.fee_status === "verified";
  const prof = r.linkedin_verified != null && r.status !== "under_review";
  if (prof && !fee) return "fee_pending";
  if (fee) return "profiling_pending";
  return "new";
}

type Master = {
  id: string;
  primary_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  last_team: string | null;
  stats: unknown;
};

// The form's own answers first; a returning player's record fills the gaps.
function roleOf(
  r: {
    batting_hand: string | null;
    bowling_type: string | null;
    allrounder: string | null;
    is_keeper: boolean | null;
  },
  m?: Master,
) {
  if (
    !r.batting_hand &&
    !r.bowling_type &&
    !r.allrounder &&
    !r.is_keeper &&
    m?.primary_role
  )
    return [m.primary_role, m.bowling_style].filter(Boolean).join(" · ");
  const bits = [
    r.is_keeper ? "Wicket-keeper" : null,
    r.allrounder,
    r.batting_hand?.replace(" Batsman", " bat"),
    r.bowling_type,
  ].filter(Boolean);
  return bits.join(" · ") || "Role not given";
}

export async function loadOwnerPool({
  photos = true,
}: { photos?: boolean } = {}): Promise<PoolEntry[] | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;
  const { data, error } = await sb
    .from("registrations")
    .select(
      "id, phone, full_name, status, fee_status, linkedin_verified, is_returning, master_id, batting_hand, bowling_type, allrounder, is_keeper, employer, designation, photo_thumb_path, created_at",
    )
    .eq("season", SEASON)
    // Page 1 saved, fee never paid (playful-site two-page form): not a registration yet.
    .neq("status", "awaiting_payment")
    .order("created_at", { ascending: false });
  if (error) return null;

  type Row = {
    id: string;
    phone: string | null;
    full_name: string;
    status: string;
    fee_status: string | null;
    linkedin_verified: boolean | null;
    is_returning: boolean;
    master_id: string | null;
    batting_hand: string | null;
    bowling_type: string | null;
    allrounder: string | null;
    is_keeper: boolean | null;
    employer: string | null;
    designation: string | null;
    photo_thumb_path: string | null;
    created_at: string;
  };
  // Nobody is hidden by phone number (Nikhil, 7 Nov): test entries are deleted, not filtered.
  const rows = (data ?? []) as Row[];

  const ids = rows.map((r) => r.master_id).filter(Boolean) as string[];
  const masters = new Map<string, Master>();
  if (ids.length) {
    const { data: ms } = await sb
      .from("player_master")
      .select(
        "id, primary_role, batting_style, bowling_style, last_team, stats",
      )
      .in("id", ids);
    for (const m of (ms ?? []) as Master[]) masters.set(m.id, m);
  }
  const statsOn = (m?: Master) =>
    !!m?.stats &&
    typeof m.stats === "object" &&
    Object.keys(m.stats as object).length > 0;

  // Photos sit in a private bucket: hand out short-lived links to the thumbnails only.
  const signed = new Map<string, string>();
  const paths = photos
    ? (rows.map((r) => r.photo_thumb_path).filter(Boolean) as string[])
    : [];
  if (paths.length) {
    const { data: urls } = await sb.storage
      .from("registrations")
      .createSignedUrls(paths, 60 * 60);
    for (const u of (urls ?? []) as {
      path: string | null;
      signedUrl: string | null;
    }[])
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  const num = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const headline = (m?: Master): PoolEntry["stats"] => {
    if (!statsOn(m)) return null;
    const st = m!.stats as Record<string, unknown>;
    return {
      m: num(st.matches),
      runs: num(st.runs),
      avg: num(st.bat_avg),
      sr: num(st.bat_sr),
      hs: st.highest != null ? String(st.highest) : null,
      wk: num(st.wickets),
      econ: num(st.economy),
      best: st.best_bowling != null ? String(st.best_bowling) : null,
    };
  };
  // Only the league team's own CricHeroes entry earns the "checked" mark (same rule as the admin red tick).
  const checked = (m?: Master) => {
    const st = (m?.stats ?? {}) as Record<string, unknown>;
    return typeof st._by === "string" && /cricheroes/i.test(st._by) && typeof st._updated === "string" ? st._updated : null;
  };

  return rows.map((r) => {
    const m = r.master_id ? masters.get(r.master_id) : undefined;
    return {
      id: r.id,
      name: r.full_name,
      status: stageOf(r),
      recommend: r.status === "under_review",
      returning: r.is_returning,
      role: roleOf(r, m),
      employer: r.employer,
      designation: r.designation,
      photo: r.photo_thumb_path
        ? (signed.get(r.photo_thumb_path) ?? null)
        : null,
      lastTeam: m?.last_team ?? null,
      hasData: statsOn(m),
      stats: headline(m),
      checkedOn: checked(m),
      at: r.created_at,
    };
  });
}
