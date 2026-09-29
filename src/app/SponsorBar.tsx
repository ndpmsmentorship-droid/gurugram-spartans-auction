import Image from "next/image";
import { TITLE_SPONSOR, PRESENTED_BY, PARTNERS, type Sponsor } from "./sponsors";

// Sponsor bar under the masthead on every page. The title sponsor and the
// presenter hold fixed slots on the left; the partners run as a slow marquee on
// the right (the list is rendered twice so the loop is seamless). Reduced-motion
// users get a static, scrollable row instead — see .sponsor-track in globals.css.
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
        className="h-8 w-auto sm:h-9"
        sizes="120px"
      />
    </div>
  );
}

export default function SponsorBar() {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:gap-6 sm:px-7">
        <Lockup s={TITLE_SPONSOR} />
        <span className="h-8 w-px shrink-0 bg-line" aria-hidden />
        <Lockup s={PRESENTED_BY} />
        <span className="h-8 w-px shrink-0 bg-line" aria-hidden />
        <div
          className="sponsor-viewport min-w-0 flex-1"
          aria-label="Season partners"
        >
          <ul className="sponsor-track">
            {[...PARTNERS, ...PARTNERS].map((s, i) => (
              <li key={`${s.name}-${i}`} aria-hidden={i >= PARTNERS.length}>
                <Image
                  src={s.logo}
                  alt={i < PARTNERS.length ? `${s.name} — ${s.role}` : ""}
                  className="h-7 w-auto"
                  sizes="110px"
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
