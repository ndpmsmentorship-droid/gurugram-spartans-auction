// The Gurugram Spartans honours mark — metallic stars + a red dot.
// Pattern: gold · silver · red dot · silver · gold.

function Star({ id, from, to, stroke }: { id: string; from: string; to: string; stroke: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[0.95em] w-[0.95em]">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.9 6.4 19.7l1.3-6.3L2.9 9.1l6.4-.7L12 2.5z"
        fill={`url(#${id})`}
        stroke={stroke}
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Dot() {
  return (
    <svg viewBox="0 0 24 24" className="h-[0.72em] w-[0.72em]">
      <defs>
        <radialGradient id="ss-red" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#F26D62" />
          <stop offset="1" stopColor="#D0342A" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="6" fill="url(#ss-red)" stroke="#A81E15" strokeWidth="0.8" />
    </svg>
  );
}

export default function SpartansStars({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-[2px] align-middle ${className}`}
      aria-label="Honours mark"
      title="Gurugram Spartans honours"
    >
      <Star id="ss-gold-a" from="#FBD75B" to="#D2911F" stroke="#B4820F" />
      <Star id="ss-silver-a" from="#FBFCFD" to="#AEB6BF" stroke="#8A929B" />
      <Dot />
      <Star id="ss-silver-b" from="#FBFCFD" to="#AEB6BF" stroke="#8A929B" />
      <Star id="ss-gold-b" from="#FBD75B" to="#D2911F" stroke="#B4820F" />
    </span>
  );
}
