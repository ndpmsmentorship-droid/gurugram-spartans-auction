// Which league the auction side of the portal is running. The SDLL look and
// feel never changes; this flips the labels and rules that differ between
// leagues. Flip it TOGETHER with the database (scripts/league-switch.mts), then
// commit + push — main auto-deploys.
//
//   "sdll" — Shanti Devi Legend's League Season 2 (A+ / A / B / Special)
//   "uscl" — Urban Sports Champions League Season 2, run as a live demo for
//            Gurugram Spartans (A+ / A / B / Legend, ₹3,00,000 purse)
export type League = "sdll" | "uscl";
export const LEAGUE: League = "uscl";

export const LEAGUE_NAME: Record<League, string> = {
  sdll: "Shanti Devi Legend's League · Season 2",
  uscl: "Urban Sports Champions League · Season 2",
};
