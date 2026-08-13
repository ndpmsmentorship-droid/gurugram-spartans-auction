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

// Chip colours per the approved design comps: the AGE band carries the hue
// (35+ = brand rose, U35 = blue) and the GRADE carries the weight (A saturated,
// B muted). Blue is a data encoding for the age band only — it is never used as
// a second brand colour anywhere else in the UI.
export function tierStyle(tier: string | null | undefined): { bg: string; fg: string } | null {
  const { age, grade } = parseTier(tier);
  if (!age || !grade) return null;
  if (age === "U35") {
    return grade === "A"
      ? { bg: "var(--u35-fill)", fg: "var(--u35)" }
      : { bg: "color-mix(in srgb, var(--u35-fill) 55%, #ffffff)", fg: "var(--u35)" };
  }
  return grade === "A"
    ? { bg: "color-mix(in srgb, var(--red) 16%, #ffffff)", fg: "var(--accent-text)" }
    : { bg: "var(--chip)", fg: "var(--muted)" };
}

// Legend is a category, not a tier — gold, matching the crest's star motif.
export const LEGEND_STYLE = { bg: "var(--gold-fill)", fg: "var(--gold)" };

// "LHB · Right-arm off-break" style one-liner; either half may be missing.
export function handSkill(
  battingStyle: string | null | undefined,
  bowlingStyle: string | null | undefined
): string | null {
  const parts = [battingStyle, bowlingStyle].map((s) => (s ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
