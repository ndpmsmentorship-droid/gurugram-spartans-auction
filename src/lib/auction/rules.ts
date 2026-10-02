// SDLL house rules, in one place. These MIRROR the server-side checks in
// supabase/sdll_migration.sql — the database is the authority, this copy
// exists so the console can grey out an illegal button before you press it.
// If you change a number here, change it in auction_rules too.
//
// Source: the league platform's tournament config (pulled 14-Aug-26).
// min_increment 500 — Season 1 cleared at ₹500 steps (…372,500 / …431,500).

import { normCategory, type AuctionCategory } from "@/lib/scout/tier";
import { LEAGUE } from "@/lib/league";

export type Rules = {
  squadMin: number;
  squadMax: number;
  maxBid: number;
  minIncrement: number;
  base: Record<AuctionCategory, number>;
  cap: Record<AuctionCategory, number>;
};

const SDLL_RULES: Rules = {
  squadMin: 16,
  squadMax: 25,
  maxBid: 400000,
  minIncrement: 500,
  base: { "A+": 30000, A: 20000, B: 10000, Special: 5000 },
  cap: { "A+": 3, A: 8, B: 13, Special: 3 },
};

// USCL Season 2 "Owners & Retention Rules" deck: owner prices A+ 20K, A 10K,
// B/Legend 3K; at most 2 A+, 6 A (5 with one A+, 3 with two), 1 Legend;
// playing 12 + 1 Legend. ₹1,75,000 purse + ₹1,25,000 top-up = ₹3,00,000.
// Mirrors auction_rules for the USCL season (scripts/uscl-setup.mts).
const USCL_RULES: Rules = {
  squadMin: 13,
  squadMax: 22,
  maxBid: 300000,
  minIncrement: 1000,
  base: { "A+": 20000, A: 10000, B: 3000, Special: 3000 },
  cap: { "A+": 2, A: 6, B: 22, Special: 1 },
};

export const DEFAULT_RULES: Rules = LEAGUE === "uscl" ? USCL_RULES : SDLL_RULES;

/** USCL: how many A players a squad may hold given its A+ count (deck p.4). */
// USCL deck, "Owners & Retention Rules": owner picks cost the category base
// (A+ 20K · A 10K · B/Legend 3K); retentions cost more.
export const USCL_RETAIN: Record<AuctionCategory, number> = { "A+": 25000, A: 15000, B: 6000, Special: 3000 };

export const usclACap = (aPlus: number) => (aPlus >= 2 ? 3 : aPlus === 1 ? 5 : 6);

export const basePriceFor = (c: string | null | undefined, r: Rules = DEFAULT_RULES) =>
  r.base[normCategory(c) ?? "B"];

export const categoryCap = (c: string | null | undefined, r: Rules = DEFAULT_RULES) =>
  r.cap[normCategory(c) ?? "B"];

export const inr = (n: number | null | undefined) =>
  "₹" + Math.round(n || 0).toLocaleString("en-IN");

/** Quick-raise ladder — coarser as the price climbs, the way a room bids. */
export function raiseSteps(current: number | null, base: number, r: Rules = DEFAULT_RULES) {
  const from = current ?? base;
  const step = from < 20000 ? r.minIncrement : from < 50000 ? 1000 : 2500;
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
    /** lot player's category + how many of it the team already holds */
    lotCategory: string | null;
    categoryCount: number;
  },
  r: Rules = DEFAULT_RULES
): string | null {
  if (args.isLeading) return "Already leading";
  if (args.amount > r.maxBid) return `Over the ${inr(r.maxBid)} ceiling`;
  if (args.squadSize >= r.squadMax) return `Squad full (${r.squadMax})`;
  if (args.spent + args.amount > args.purse)
    return `Over purse — ${inr(args.purse - args.spent)} left`;
  const cat = normCategory(args.lotCategory);
  if (cat && args.categoryCount >= r.cap[cat])
    return `${cat} slots full (${r.cap[cat]})`;
  return null;
}
