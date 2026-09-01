import Image from "next/image";

/**
 * A team's logo, with a lettered fallback.
 *
 * Every surface that names a team renders this, so uploading a logo once in
 * Admin → Teams shows up on the live board, schedule, squads, my-team and the
 * owner list without touching any of them. Teams with no logo yet get their
 * initials rather than a broken image, so a half-filled list still looks
 * deliberate.
 */
export default function TeamCrest({
  name,
  logoUrl,
  size = 28,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        // Logos are user-uploaded to Supabase Storage; skipping the optimiser
        // avoids configuring a remote pattern for every future bucket host.
        unoptimized
        className="shrink-0 rounded-full object-contain"
        style={{ width: size, height: size, background: "var(--tile)" }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-mono font-medium"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.36),
        background: "var(--blush-a)",
        color: "var(--maroon)",
        letterSpacing: "0.02em",
      }}
    >
      {initials || "?"}
    </span>
  );
}
