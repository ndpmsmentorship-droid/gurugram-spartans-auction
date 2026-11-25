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

// The key at the foot of the Plan and Live pool pages: three quiet columns — what the league has
// checked, who the player is, how he plays — each mark shown exactly as it appears on a player.
const KEY: { title: string; items: { mark: React.ReactNode; name: string; text: string }[] }[] = [
  {
    title: "Checked by the league",
    items: [
      { mark: <Seal colour="var(--red)" label="CricHeroes" title="" />, name: "Numbers verified", text: "CricHeroes figures checked and entered by the league, with the date." },
      { mark: <Seal colour="var(--up)" label="Fee paid" title="" />, name: "Fee paid", text: "Registration fee received and verified." },
      { mark: <PaymentPending />, name: "Payment pending", text: "Form filled, fee not paid — not in the pool yet." },
    ],
  },
  {
    title: "Who he is",
    items: [
      {
        mark: (
          <span className="flex flex-wrap gap-1">
            <AgeChip band="Under 35" />
            <AgeChip band="35–39" />
            <AgeChip band="40+" />
          </span>
        ),
        name: "Age bracket",
        text: "Age on Sun 7 Mar 2027. Exact ages stay with the league.",
      },
      {
        mark: (
          <span className="flex flex-wrap gap-1">
            <CategoryChip cat="A+" />
            <CategoryChip cat="Legend" />
          </span>
        ),
        name: "Category",
        text: "Under 35 is A+. Legend: 60+, or average under 10 and SR under 100. Others A or B once SPI is out.",
      },
      { mark: <OwnerChip team="Team" />, name: "Owner", text: "Plays for his own franchise; placed in its XII first." },
    ],
  },
  {
    title: "How he plays",
    items: [
      { mark: <TagChips tags={["Hard Hitter"]} />, name: "CricHeroes tag", text: "Hard Hitter, Accumulator, Economist, Spearhead and more." },
      {
        mark: <span className="whitespace-nowrap rounded-full bg-gold-fill px-1.5 py-0.5 text-[0.625rem] font-semibold leading-none text-gold">No data yet</span>,
        name: "No numbers yet",
        text: "Not in the sorted suggestions until his figures are in — search still finds him.",
      },
    ],
  },
];

export function MarkerKey() {
  return (
    <section className="mx-auto mt-10 w-full max-w-[1280px] rounded-[18px] border border-line bg-surface px-5 py-5 shadow-[var(--elev-sm)] sm:px-7 sm:py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-3">
        <h3 className="font-display text-lg font-bold uppercase tracking-wide">What the marks mean</h3>
        <p className="text-[0.72rem] text-muted">Every mark below appears exactly like this on a player.</p>
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-line">
        {KEY.map((col, c) => (
          <div key={col.title} className={c === 0 ? "lg:pr-7" : c === KEY.length - 1 ? "lg:pl-7" : "lg:px-7"}>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-red">{col.title}</p>
            <dl className="mt-3 space-y-3.5">
              {col.items.map((it) => (
                <div key={it.name} className="grid grid-cols-[8.5rem_1fr] items-start gap-3">
                  <dt className="flex min-h-[1.25rem] items-center">{it.mark}</dt>
                  <dd className="min-w-0">
                    <p className="text-[0.8rem] font-semibold leading-tight text-ink">{it.name}</p>
                    <p className="mt-0.5 text-[0.72rem] leading-snug text-muted">{it.text}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
