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

// The USCL demo switches itself off at midnight after the auction (Nikhil, 3 Oct):
// from then on only the admin can sign in; every owner login is refused and the
// War Room / live board are closed. Flip LEAGUE back to "sdll" afterwards.
export const USCL_CLOSES_AT = Date.parse("2026-10-04T00:00:00+05:30");
export const usclClosed = (now = Date.now()) => LEAGUE === "uscl" && now >= USCL_CLOSES_AT;

export const LEAGUE_NAME: Record<League, string> = {
  sdll: "Shanti Devi Legend's League · Season 2",
  uscl: "Urban Sports Champions League · Season 2",
};
