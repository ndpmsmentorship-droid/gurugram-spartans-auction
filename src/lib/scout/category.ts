// Fine player categories for the pool: an auto-derived best guess (from the
// coarse league role text + stats) that any user can override per player.
// The override is stored on scout_players.scout_category; when absent we fall
// back to autoCategory(). Read-side only — no external service.

export const CATEGORIES = [
  "Top Order",
  "Middle Order",
  "Finisher / Lower Order",
  "Batting All-Rounder",
  "Bowling All-Rounder",
  "Fast Bowler",
  "Medium Pacer",
  "Off Break",
  "Leg Break",
  "Left-Arm Orthodox",
  "Left-Arm Pace",
  "Bowler",
  "Wicket-Keeper",
  "Uncategorized",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Solid pills so they read in both light and dark themes. Grouped by family:
// batting = blues, all-rounders = teal, pace = red/orange, spin = green,
// keeper = purple, generic/none = grey.
export const CATEGORY_META: Record<Category, { bg: string; fg: string }> = {
  "Top Order": { bg: "#2F6FED", fg: "#ffffff" },
  "Middle Order": { bg: "#5B8DF2", fg: "#ffffff" },
  "Finisher / Lower Order": { bg: "#9DBEF8", fg: "#12305f" },
  "Batting All-Rounder": { bg: "#0E9F8E", fg: "#ffffff" },
  "Bowling All-Rounder": { bg: "#12B9A4", fg: "#06342e" },
  "Fast Bowler": { bg: "#E0453A", fg: "#ffffff" },
  "Medium Pacer": { bg: "#F08A3D", fg: "#3a2205" },
  "Off Break": { bg: "#2E8B57", fg: "#ffffff" },
  "Leg Break": { bg: "#4FB06F", fg: "#0a3319" },
  "Left-Arm Orthodox": { bg: "#1F7A46", fg: "#ffffff" },
  "Left-Arm Pace": { bg: "#C2371D", fg: "#ffffff" },
  Bowler: { bg: "#8A8F98", fg: "#ffffff" },
  "Wicket-Keeper": { bg: "#7C5CD6", fg: "#ffffff" },
  Uncategorized: { bg: "#D8DBE0", fg: "#3a3d42" },
};

export type CategoryInput = {
  primary_role: string | null;
  is_keeper: boolean;
  bat_index: number | null;
  bowl_index: number | null;
  bat_sr: number | null;
  bat_avg: number | null;
  runs: number | null;
};

// Detect a specific bowling style from the free-text role, if stated.
function bowlingStyle(role: string): Category | null {
  if (/left|slow left|sla\b/.test(role)) {
    if (/orthodox|slow|spin|chinaman|wrist|sla/.test(role)) return "Left-Arm Orthodox";
    if (/fast|medium|pace|seam/.test(role)) return "Left-Arm Pace";
  }
  if (/off[\s-]?break|off[\s-]?spin|offie|\boff\b/.test(role)) return "Off Break";
  if (/leg[\s-]?break|leg[\s-]?spin|googly|wrist|chinaman/.test(role)) return "Leg Break";
  if (/fast/.test(role)) return "Fast Bowler";
  if (/medium|seam|pace/.test(role)) return "Medium Pacer";
  return null;
}

// Best-guess category. Bowling *style* only survives where the league role text
// carries it (most Sarda rows don't) — unknown-style bowlers land in "Bowler".
export function autoCategory(p: CategoryInput): Category {
  const role = (p.primary_role ?? "").toLowerCase();
  if (p.is_keeper || /keep|\bwk\b/.test(role)) return "Wicket-Keeper";

  const bat = p.bat_index ?? 0;
  const bowl = p.bowl_index ?? 0;
  const style = bowlingStyle(role);

  const isAllrounder = /all[\s-]?round|allrounder/.test(role) || (bat >= 50 && bowl >= 50);
  if (isAllrounder) return bat >= bowl ? "Batting All-Rounder" : "Bowling All-Rounder";

  const looksBowler =
    /bowl|spin|pace|fast|medium|seam|break|googly|orthodox/.test(role) || bowl > bat + 12;
  if (looksBowler) return style ?? "Bowler";

  // otherwise treat as a batter and split by stats
  const sr = p.bat_sr ?? 0;
  const avg = p.bat_avg ?? 0;
  if (sr >= 140 && avg > 0 && avg < 25) return "Finisher / Lower Order";
  if (bat >= 60 || (sr >= 130 && avg >= 28)) return "Top Order";
  if (bat > 0 || (p.runs ?? 0) > 0 || /bat/.test(role)) return "Middle Order";
  return "Uncategorized";
}

// Resolve the category to show/use: explicit override wins, else the auto guess.
export function resolveCategory(
  p: CategoryInput & { scout_category?: string | null }
): { category: Category; isOverride: boolean } {
  const override = (p.scout_category ?? "").trim();
  if (override && (CATEGORIES as readonly string[]).includes(override)) {
    return { category: override as Category, isOverride: true };
  }
  return { category: autoCategory(p), isOverride: false };
}
