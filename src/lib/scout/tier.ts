// The organizers' auction tier (U35A / U35B / 35+A / 35+B) and a compact
// batting-hand + bowling-style descriptor, shared by every card that shows a
// scout player. Tier drives the squad composition caps (≤6 A, ≤3 U35) too, so
// the parsing lives in one place.

export type TierParts = { age: "U35" | "35+" | null; grade: "A" | "B" | null };

// "U35A" → { age:"U35", grade:"A" };  "35+B" → { age:"35+", grade:"B" }
export function parseTier(tier: string | null | undefined): TierParts {
  const t = (tier ?? "").toUpperCase().replace(/\s+/g, "");
  const age = t.startsWith("U35") ? "U35" : t.startsWith("35+") ? "35+" : null;
  const grade = t.endsWith("A") ? "A" : t.endsWith("B") ? "B" : null;
  return { age, grade };
}

export const isGradeA = (tier: string | null | undefined) => parseTier(tier).grade === "A";
export const isU35 = (tier: string | null | undefined) => parseTier(tier).age === "U35";

// Pill colours, all drawn from the Shanti Devi palette — the brand book carries
// no second hue, so the tiers separate by WEIGHT rather than by colour:
// A grades take a solid red fill (they are the premium lots and should shout),
// B grades recede to a red tint / neutral chip. Within each grade U35 runs a
// step brighter than 35+ so the age band still reads at a glance.
// Returns CSS custom properties, so both themes are handled for free.
export function tierStyle(tier: string | null | undefined): { bg: string; fg: string } | null {
  const { age, grade } = parseTier(tier);
  if (!age || !grade) return null;
  if (grade === "A") {
    return age === "U35"
      ? { bg: "var(--red)", fg: "#ffffff" } // U35A — brightest, top of the tree
      : { bg: "var(--red-deep)", fg: "#ffffff" }; // 35+A
  }
  return age === "U35"
    ? { bg: "color-mix(in srgb, var(--red-deep) 26%, transparent)", fg: "var(--accent-text)" } // U35B
    : { bg: "var(--chip)", fg: "var(--muted)" }; // 35+B
}

// "LHB · Right-arm off-break" style one-liner; either half may be missing.
export function handSkill(
  battingStyle: string | null | undefined,
  bowlingStyle: string | null | undefined
): string | null {
  const parts = [battingStyle, bowlingStyle].map((s) => (s ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
