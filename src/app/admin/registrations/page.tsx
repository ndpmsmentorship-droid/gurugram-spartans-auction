import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEASON, BUCKET } from "@/app/register/shared";
import { markLinkedin, setStatus } from "./actions";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TABS = [
  { key: "pending", label: "New" },
  { key: "under_review", label: "Under review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-wash text-ink",
  under_review: "bg-gold-fill text-gold",
  approved: "bg-[color-mix(in_srgb,var(--up)_12%,transparent)] text-up",
  rejected: "bg-[color-mix(in_srgb,var(--red)_10%,transparent)] text-red-deep",
};

function age(dob: string | null): string | null {
  if (!dob) return null;
  const y = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5));
  return Number.isFinite(y) ? `${y} yrs` : null;
}

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  const tab = TABS.some((t) => t.key === s) ? (s as string) : "pending";
  const admin = createAdminClient();
  const sb = admin as unknown as { from: (t: string) => any; storage: any };

  const { data: all, error } = await sb
    .from("registrations")
    .select("*")
    .eq("season", SEASON)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="card">
        <p className="eyebrow">Admin</p>
        <h1 className="mt-2 font-display text-2xl font-bold">Registrations</h1>
        <p className="mt-3 text-sm text-muted">
          Registration isn&apos;t set up yet. Paste <code>supabase/registration_schema.sql</code> into
          the Supabase SQL Editor and run it once.
        </p>
      </div>
    );
  }

  const rows = (all ?? []) as any[];
  const counts = Object.fromEntries(TABS.map((t) => [t.key, rows.filter((r) => r.status === t.key).length]));
  const shown = rows.filter((r) => r.status === tab);

  // Short-lived links for the private photo / Aadhaar files (1 hour).
  const paths = shown.flatMap((r) => [r.photo_path, r.aadhaar_path]).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
    (data ?? []).forEach((d: any) => d.signedUrl && signed.set(d.path, d.signedUrl));
  }

  return (
    <div>
      <p className="eyebrow">Admin</p>
      <h1 className="mt-2 font-display text-2xl font-bold">Registrations · Season 2</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        {rows.length} registered. Open each LinkedIn profile and tick whether it shows 500+
        connections. Anyone below 500, or approved without the tick, moves to Under review.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/registrations?s=${t.key}`} className="pill" data-active={tab === t.key}>
            {t.label} <span className="num">{counts[t.key]}</span>
          </Link>
        ))}
      </div>

      <ul className="mt-6 space-y-4">
        {shown.length === 0 && <li className="text-sm text-muted">Nobody here yet.</li>}
        {shown.map((r) => {
          const roles = [r.batting_hand, r.bowling_type, r.allrounder, r.is_keeper ? "Wicket keeper" : null].filter(Boolean);
          const photo = r.photo_path ? signed.get(r.photo_path) : null;
          const aadhaar = r.aadhaar_path ? signed.get(r.aadhaar_path) : null;
          return (
            <li key={r.id} className="card">
              <div className="flex flex-wrap items-start gap-4">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-wash font-display text-xl">
                    {String(r.full_name).slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl">{r.full_name}</h2>
                    <span className={`badge ${STATUS_STYLE[r.status] ?? ""}`}>{r.status.replace("_", " ")}</span>
                    <span className="badge bg-wash">{r.is_returning ? "Returning" : "New player"}</span>
                  </div>
                  <p className="num mt-1 text-sm text-muted">
                    {[r.phone, r.email, age(r.dob)].filter(Boolean).join(" · ")}
                  </p>
                  {roles.length > 0 && <p className="mt-1 text-sm">{roles.join(" · ")}</p>}
                  <p className="mt-1 text-sm text-muted">
                    Kit: <strong className="text-ink">{r.jersey_name ?? "—"} #{r.jersey_number ?? "—"}</strong> · T-shirt {r.tshirt_size ?? "—"} · Lower {r.lower_size ?? "—"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    {r.linkedin_link && (
                      <a className="text-accent-text underline" href={/^https?:/.test(r.linkedin_link) ? r.linkedin_link : `https://${r.linkedin_link}`} target="_blank" rel="noopener noreferrer">
                        LinkedIn ↗
                      </a>
                    )}
                    {r.cricheroes_link && (
                      <a className="text-accent-text underline" href={/^https?:/.test(r.cricheroes_link) ? r.cricheroes_link : `https://${r.cricheroes_link}`} target="_blank" rel="noopener noreferrer">
                        CricHeroes ↗
                      </a>
                    )}
                    {aadhaar && (
                      <a className="text-accent-text underline" href={aadhaar} target="_blank" rel="noopener noreferrer">
                        Aadhaar ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <span className="label-mono mr-1">
                  LinkedIn 500+:{" "}
                  {r.linkedin_verified === true ? "yes" : r.linkedin_verified === false ? "no" : "not checked"}
                </span>
                <form action={markLinkedin}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="verdict" value="yes" />
                  <button className="pill" data-active={r.linkedin_verified === true}>500+ ✓</button>
                </form>
                <form action={markLinkedin}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="verdict" value="no" />
                  <button className="pill" data-active={r.linkedin_verified === false}>Under 500</button>
                </form>
                <span className="mx-1 h-6 w-px bg-line" aria-hidden />
                {(["approved", "under_review", "rejected"] as const)
                  .filter((st) => st !== r.status)
                  .map((st) => (
                    <form key={st} action={setStatus}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value={st} />
                      <button className={st === "approved" ? "btn-primary !py-2" : "btn-ghost !py-2"}>
                        {st === "approved" ? "Approve" : st === "under_review" ? "Under review" : "Reject"}
                      </button>
                    </form>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
