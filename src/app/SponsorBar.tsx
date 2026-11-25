import Image from "next/image";
import { TITLE_SPONSOR, PRESENTED_BY, logoSize, type Sponsor } from "./sponsors";
import crest from "./brand/crest.png";

// The bar under the masthead on every page: title sponsor and presenter on the left; on the right
// the league crest with the season and the auction date (Nikhil, 25 Nov 2026: replaced the running
// partner-logo marquee — PARTNERS in sponsors.ts is kept for other pages).
function Lockup({ s }: { s: Sponsor }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <span className="label-mono hidden text-right leading-tight sm:block">
        {s.role.split(" ").map((w) => (
          <span key={w} className="block">
            {w}
          </span>
        ))}
      </span>
      <Image
        src={s.logo}
        alt={`${s.name} — ${s.role}`}
        style={logoSize(s.logo, 3400, 40)}
        sizes="120px"
      />
    </div>
  );
}

export default function SponsorBar() {
  return (
    <div className="border-b border-line bg-surface">
      <div className="relative mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:gap-6 sm:px-7">
        {/* League name in the middle of the bar (Nikhil, 25 Nov 2026); laptop widths only — phones have no room. */}
        <p className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center lg:block">
          <span className="block font-display text-[1.1rem] font-bold uppercase leading-none tracking-[0.05em] xl:text-[1.35rem] xl:tracking-[0.06em] text-ink">Shanti Devi Legend’s League</span>
          <span className="mt-1 block font-mono text-[0.58rem] uppercase tracking-[0.3em] text-red">Legends never retire</span>
        </p>
        <Lockup s={TITLE_SPONSOR} />
        <span className="h-8 w-px shrink-0 bg-line" aria-hidden />
        <Lockup s={PRESENTED_BY} />
        <div className="ml-auto flex min-w-0 items-center gap-3">
          <Image src={crest} alt="Shanti Devi Legend’s League crest" className="h-10 w-auto shrink-0" sizes="40px" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-[0.95rem] font-bold uppercase tracking-wide text-ink">Season 2</span>
            <span className="hidden font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted sm:block">Auction · Sat 19 Dec 2026</span>
            <span className="block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted sm:hidden">Auction 19 Dec</span>
          </span>
        </div>
      </div>
    </div>
  );
}
