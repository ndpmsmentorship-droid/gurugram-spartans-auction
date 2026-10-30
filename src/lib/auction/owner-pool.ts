import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// The live player pool for the owners' portal: every Season 2 registration as
// it comes in, grouped Selected / Under review / Rejected from the league's
// vetting. Owners see cricket and work details only — never phone, email, date
// of birth, Aadhaar, fee or vetting notes.
export type PoolStatus = "selected" | "review" | "rejected";
export type PoolEntry = {
  id: string;
  name: string;
  status: PoolStatus;
  returning: boolean;
  role: string;
  employer: string | null;
  designation: string | null;
  photo: string | null;
  at: string; // registered
};

const SEASON = "SDLL-S2";
const GROUP: Record<string, PoolStatus> = { approved: "selected", rejected: "rejected", pending: "review", under_review: "review" };
// Test entries made while building the form (dummy 99999… numbers) stay out of the owners' view.
const isTest = (phone: string | null) => !!phone && /^9{5}/.test(phone);

function roleOf(r: { batting_hand: string | null; bowling_type: string | null; allrounder: string | null; is_keeper: boolean | null }) {
  const bits = [
    r.is_keeper ? "Wicket-keeper" : null,
    r.allrounder,
    r.batting_hand?.replace(" Batsman", " bat"),
    r.bowling_type,
  ].filter(Boolean);
  return bits.join(" · ") || "Role not given";
}

export async function loadOwnerPool({ photos = true }: { photos?: boolean } = {}): Promise<PoolEntry[] | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;
  const { data, error } = await sb
    .from("registrations")
    .select("id, phone, full_name, status, is_returning, batting_hand, bowling_type, allrounder, is_keeper, employer, designation, photo_thumb_path, created_at")
    .eq("season", SEASON)
    .order("created_at", { ascending: false });
  if (error) return null;

  type Row = {
    id: string; phone: string | null; full_name: string; status: string; is_returning: boolean;
    batting_hand: string | null; bowling_type: string | null; allrounder: string | null; is_keeper: boolean | null;
    employer: string | null; designation: string | null; photo_thumb_path: string | null; created_at: string;
  };
  const rows = ((data ?? []) as Row[]).filter((r) => !isTest(r.phone));

  // Photos sit in a private bucket: hand out short-lived links to the thumbnails only.
  const signed = new Map<string, string>();
  const paths = photos ? (rows.map((r) => r.photo_thumb_path).filter(Boolean) as string[]) : [];
  if (paths.length) {
    const { data: urls } = await sb.storage.from("registrations").createSignedUrls(paths, 60 * 60);
    for (const u of (urls ?? []) as { path: string | null; signedUrl: string | null }[]) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.full_name,
    status: GROUP[r.status] ?? "review",
    returning: r.is_returning,
    role: roleOf(r),
    employer: r.employer,
    designation: r.designation,
    photo: r.photo_thumb_path ? signed.get(r.photo_thumb_path) ?? null : null,
    at: r.created_at,
  }));
}
