// The SDLL auction categories (source: the league's own platform config,
// tournament 698076ec…, pulled 14-Aug-26):
//
//   A+       U35    base ₹30,000   max 3 per team
//   A        U35    base ₹20,000   max 8 per team
//   B        18–39  base ₹10,000   max 13 per team
//   Special  35–45  base  ₹5,000   max 3 per team
//
// This replaces the SCCL S6 tier grid (U35A / 35+B …). The import stores the
// short display name in scout_players.auction_category; normCategory() also
// accepts the platform's long names ("A+ Category", "Special Status") so raw
// API strings render correctly wherever they leak through.

export type AuctionCategory = "A+" | "A" | "B" | "Special";
export const CATEGORIES: AuctionCategory[] = ["A+", "A", "B", "Special"];

export function normCategory(c: string | null | undefined): AuctionCategory | null {
  const t = (c ?? "").trim().toUpperCase();
  if (!t) return null;
  if (t.startsWith("A+")) return "A+";
  if (t.startsWith("SPECIAL") || t === "SS") return "Special";
  if (t.startsWith("A")) return "A";
  if (t.startsWith("B")) return "B";
  return null;
}

// "Premium" = the two U35 marquee categories. Kept under the old name because
// the squad-composition helpers reason in terms of A-grade slots.
export const isGradeA = (c: string | null | undefined) => {
  const n = normCategory(c);
  return n === "A+" || n === "A";
};
export const isU35 = isGradeA; // A+ and A are the U35 categories in SDLL

// Chip colours: category rank carries the visual hierarchy. A+ wears the brand
// red (top of the market), A the blue that encoded "young" in the approved
// comps, B stays a quiet neutral (half the pool), Special goes gold — the
// 35–45 veterans' slot, matching the crest's star motif.
export function tierStyle(
  category: string | null | undefined
): { bg: string; fg: string } | null {
  switch (normCategory(category)) {
    case "A+":
      return { bg: "color-mix(in srgb, var(--red) 16%, #ffffff)", fg: "var(--accent-text)" };
    case "A":
      return { bg: "var(--u35-fill)", fg: "var(--u35)" };
    case "B":
      return { bg: "var(--chip)", fg: "var(--muted)" };
    case "Special":
      return { bg: "var(--gold-fill)", fg: "var(--gold)" };
    default:
      return null;
  }
}

// Marquee / legend accent — gold, matching the crest's star motif.
export const LEGEND_STYLE = { bg: "var(--gold-fill)", fg: "var(--gold)" };

// "LHB · Right-arm off-break" style one-liner; either half may be missing.
export function handSkill(
  battingStyle: string | null | undefined,
  bowlingStyle: string | null | undefined
): string | null {
  const parts = [battingStyle, bowlingStyle].map((s) => (s ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
