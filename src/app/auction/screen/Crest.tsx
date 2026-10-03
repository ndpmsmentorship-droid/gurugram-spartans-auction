import Image, { type StaticImageData } from "next/image";

/**
 * A team crest for the auction screens: the league's own logo file when we
 * have one (franchises.ts), an uploaded URL, or the team's initials. Sized in
 * any CSS unit so the big screen can scale it with the viewport.
 */
export default function Crest({
  name,
  logo,
  size,
  ring,
}: {
  name: string;
  logo: StaticImageData | string | null;
  size: string;
  ring?: string;
}) {
  const box = { width: size, height: size, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined };
  if (logo) {
    return (
      <span className="relative inline-block shrink-0 overflow-hidden rounded-full bg-white" style={box}>
        <Image
          src={logo}
          alt=""
          fill
          sizes="200px"
          unoptimized={typeof logo === "string"}
          className="object-contain p-[6%]"
        />
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold"
      style={{ ...box, background: "#f6e0de", color: "#570f0c", fontSize: `calc(${size} * 0.38)` }}
    >
      {initials || "?"}
    </span>
  );
}
