// SCCL house rules, in one place. These MIRROR the server-side checks in
// supabase/live_auction_schema.sql — the database is the authority, this copy
// exists so the console can grey out an illegal button before you press it.
// If you change a number here, change it in auction_rules too.

export type Rules = {
  squadMin: number;
  squadMax: number;
  maxBid: number;
  baseGradeA: number;
  baseGradeB: number;
  minIncrement: number;
};

export const DEFAULT_RULES: Rules = {
  squadMin: 16,
  squadMax: 20,
  maxBid: 65000,
  baseGradeA: 15000,
  baseGradeB: 5000,
  minIncrement: 1000,
};

const code = (c: string | null | undefined) =>
  (c ?? "").toUpperCase().replace(/\s+/g, "");

export const isLegend = (c: string | null | undefined) => code(c).includes("LEGEND");
// 'A' = U35A / 35+A. Legend is its own compulsory slot and prices as B.
export const isGradeA = (c: string | null | undefined) =>
  !isLegend(c) && code(c).endsWith("A");

export const basePriceFor = (c: string | null | undefined, r: Rules = DEFAULT_RULES) =>
  isGradeA(c) ? r.baseGradeA : r.baseGradeB;

export const inr = (n: number | null | undefined) =>
  "₹" + Math.round(n || 0).toLocaleString("en-IN");

/** Quick-raise ladder — coarser as the price climbs, the way a room bids. */
export function raiseSteps(current: number | null, base: number, r: Rules = DEFAULT_RULES) {
  const from = current ?? base;
  const step = from < 20000 ? 1000 : from < 40000 ? 2500 : 5000;
  return [step, step * 2, step * 4]
    .map((s) => from + s)
    .filter((v) => v <= r.maxBid);
}

/**
 * Why a given team cannot take this bid — null means they can. Same order the
 * SQL checks in, so the greyed-out reason matches the error you'd get anyway.
 */
export function blockReason(
  args: {
    amount: number;
    spent: number;
    purse: number;
    squadSize: number;
    isLeading: boolean;
  },
  r: Rules = DEFAULT_RULES
): string | null {
  if (args.isLeading) return "Already leading";
  if (args.amount > r.maxBid) return `Over the ${inr(r.maxBid)} ceiling`;
  if (args.squadSize >= r.squadMax) return `Squad full (${r.squadMax})`;
  if (args.spent + args.amount > args.purse)
    return `Over purse — ${inr(args.purse - args.spent)} left`;
  return null;
}
