"use client";

import type { AgeBand, Category, PoolEntry } from "@/lib/auction/owner-pool";

// The small marks on every player in the owners' portal (Plan + Live pool), and the key that
// explains them at the foot of both pages (Nikhil, 25 Nov 2026). One shape per meaning:
// a seal = something the league has checked; a pill = a status or a fact about the player.

const SEAL =
  "M12 1.5l2.4 1.8 3-.2 1 2.8 2.6 1.6-.6 2.9 1.4 2.6-2 2.2-.2 3-2.9.7-1.8 2.4-2.9-.9-2.9.9-1.8-2.4-2.9-.7-.2-3-2-2.2 1.4-2.6-.6-2.9 2.6-1.6 1-2.8 3 .2z";

function Seal({ colour, label, title, size = 13 }: { colour: string; label?: string; title: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[0.625rem] text-muted" title={title}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path fill={colour} d={SEAL} />
        <path fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M7.5 12.3l3 3 6-6.3" />
      </svg>
      {label}
    </span>
  );
}

// Red seal: the league team checked his numbers on CricHeroes and entered them.
export function StatsSeal({ on }: { on: string | null }) {
  if (!on) return null;
  const d = new Date(on).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return <Seal colour="var(--red)" label={`CricHeroes · ${d}`} title="CricHeroes numbers checked and updated by the league team" />;
}

// Green seal: registration fee received and verified by the league's accounts team.
export function FeeSeal({ paid }: { paid: boolean }) {
  if (!paid) return null;
  return <Seal colour="var(--up)" label="Fee paid" title="Registration fee received and verified by the league" />;
}

const pill = "whitespace-nowrap rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold leading-none";

export function PaymentPending() {
  return (
    <span className={`${pill} border border-dashed border-red bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-red-deep`} title="Filled the form but hasn't paid the registration fee yet — not in the pool until he pays">
      ₹ Payment pending
    </span>
  );
}

// Age bracket only (SPI brackets, age on Sun 7 Mar 2027); never the exact age or date of birth.
export const AGE_COLOUR: Record<AgeBand, string> = { "Under 35": "#bc2423", "35–39": "#1d4ed8", "40+": "#15803d" };
export function AgeChip({ band }: { band: AgeBand | null }) {
  if (!band) return null;
  return (
    <span className={`${pill} text-white`} style={{ background: AGE_COLOUR[band] }} title="Age bracket on Sun 7 Mar 2027 (SLL-2 rules, Article 2)">
      {band}
    </span>
  );
}

export function OwnerChip({ team }: { team: string | null }) {
  if (!team) return null;
  return (
    <span className={`${pill} text-white`} style={{ background: "#7c3aed" }} title={`Franchise owner of ${team}. Owners play for their own team and are not in the auction.`}>
      Owner · {team}
    </span>
  );
}

// Category per the SLL-2 rules: under 35 = A+; Legend = 60+ or career avg < 10 and SR < 100;
// everyone else A or B by SPI rank once grading is published ("A/B · SPI pending" until then).
const CAT_STYLE: Record<Category, { bg: string; fg: string; label: string; title: string }> = {
  "A+": { bg: "#0b1630", fg: "#fff", label: "A+", title: "Category A+ — every player under 35 on 7 Mar 2027" },
  Legend: { bg: "var(--gold)", fg: "#fff", label: "Legend", title: "Legend — 60+ on 7 Mar 2027, or career average under 10 and strike rate under 100 (Board may decide otherwise)" },
  "A/B": { bg: "transparent", fg: "var(--muted)", label: "A/B · SPI pending", title: "A or B by SPI rank in his age bracket, published after registration closes" },
};
export function CategoryChip({ cat }: { cat: Category | null }) {
  if (!cat) return null;
  const c = CAT_STYLE[cat];
  return (
    <span className={`${pill} ${cat === "A/B" ? "border border-line" : ""}`} style={{ background: c.bg, color: c.fg }} title={c.title}>
      {c.label}
    </span>
  );
}

export function TagChips({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <>
      {tags.map((t) => (
        <span key={t} className={`${pill} bg-[color-mix(in_srgb,var(--gold)_16%,transparent)] uppercase tracking-wide text-gold`} title="CricHeroes player tag">
          {t}
        </span>
      ))}
    </>
  );
}

// Every mark a player carries, in one row.
export function MarkRow({ p, showCategory = true }: { p: PoolEntry; showCategory?: boolean }) {
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      {p.status === "unpaid" && <PaymentPending />}
      <OwnerChip team={p.owner} />
      <AgeChip band={p.ageBand} />
      {showCategory && <CategoryChip cat={p.cat} />}
      <TagChips tags={p.tags} />
      <FeeSeal paid={p.feePaid} />
      <StatsSeal on={p.checkedOn} />
    </span>
  );
}

// The key at the foot of the Plan and Live pool pages.
export function MarkerKey() {
  const row = "flex items-start gap-2";
  const what = "text-[0.75rem] leading-snug text-muted";
  return (
    <section className="mx-auto mt-8 w-full max-w-[1280px] rounded-[14px] border border-line bg-surface p-4">
      <p className="eyebrow">What the marks mean</p>
      <div className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <div className={row}>
          <Seal colour="var(--red)" title="" size={16} />
          <p className={what}><b className="text-ink">Red seal</b> — CricHeroes numbers checked and updated by the league team (date shown).</p>
        </div>
        <div className={row}>
          <Seal colour="var(--up)" title="" size={16} />
          <p className={what}><b className="text-ink">Green seal</b> — registration fee received and verified.</p>
        </div>
        <div className={row}>
          <PaymentPending />
          <p className={what}>Filled the form, hasn&rsquo;t paid yet. Not in the pool until he pays.</p>
        </div>
        <div className={row}>
          <span className="flex shrink-0 gap-1">
            <AgeChip band="Under 35" />
            <AgeChip band="35–39" />
            <AgeChip band="40+" />
          </span>
          <p className={what}>Age on Sun 7 Mar 2027 (rules, Article 2). Exact ages and birth dates stay with the league.</p>
        </div>
        <div className={row}>
          <span className="flex shrink-0 gap-1">
            <CategoryChip cat="A+" />
            <CategoryChip cat="Legend" />
          </span>
          <p className={what}>Category: every under-35 is A+; Legend = 60+, or career avg under 10 and SR under 100. Others show &ldquo;A/B · SPI pending&rdquo; until SPI ranks are published.</p>
        </div>
        <div className={row}>
          <OwnerChip team="Team" />
          <p className={what}>A franchise owner. Owners play for their own team and are placed in its XII first.</p>
        </div>
        <div className={row}>
          <TagChips tags={["Hard Hitter"]} />
          <p className={what}>CricHeroes player tag (Hard Hitter, Accumulator, Economist, Spearhead…).</p>
        </div>
        <div className={row}>
          <span className="shrink-0 rounded-full bg-gold-fill px-1.5 py-0.5 text-[0.625rem] text-gold">No data yet</span>
          <p className={what}>No CricHeroes numbers on record yet, so he isn&rsquo;t in the sorted suggestions (search still finds him).</p>
        </div>
      </div>
    </section>
  );
}
