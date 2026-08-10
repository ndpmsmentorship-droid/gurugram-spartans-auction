// The Gurugram Spartans honours mark: four stars — two gold (champions),
// two silver (runners-up). Reused wherever the club is named.

const GOLD = "#E3A81B";
const GOLD_HI = "#F6CB49";
const SILVER = "#9AA0A6";
const SILVER_HI = "#C9CED3";

function Star({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[0.9em] w-[0.9em]">
      <path
        d="M12 2.5l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.9 6.4 19.7l1.3-6.3L2.9 9.1l6.4-.7L12 2.5z"
        fill={fill}
        stroke={stroke}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const RED = "#E0453A";
const RED_HI = "#B4291F";

function Dot({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[0.7em] w-[0.7em]">
      <circle cx="12" cy="12" r="5.5" fill={fill} stroke={stroke} strokeWidth="1" />
    </svg>
  );
}

// Honours mark: gold star (1st), silver stars (2nd & 4th) and a red dot (3rd).
export default function SpartansStars({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-[2px] align-middle ${className}`}
      aria-label="Honours: champions, two runners-up, and a third-place finish"
      title="Honours across seasons"
    >
      <Star fill={GOLD} stroke={GOLD_HI} />
      <Star fill={SILVER} stroke={SILVER_HI} />
      <Dot fill={RED} stroke={RED_HI} />
      <Star fill={SILVER} stroke={SILVER_HI} />
    </span>
  );
}
