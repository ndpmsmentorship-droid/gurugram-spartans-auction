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
  /** bid step per category (USCL rulebook); falls back to minIncrement */
  step?: Record<AuctionCategory, number>;
};

const SDLL_RULES: Rules = {
  squadMin: 16,
  squadMax: 25,
  maxBid: 400000,
  minIncrement: 500,
  base: { "A+": 30000, A: 20000, B: 10000, Special: 5000 },
  cap: { "A+": 3, A: 8, B: 13, Special: 3 },
};

// USCL Season 2 OFFICIAL RULEBOOK (received 2 Oct 2026):
//  - auction base / increment: Legend 3K / 1K · A+ 20K / 5K · A 10K / 3K · B 6K / 2K
//  - purse ₹1,75,000 (after owner-player value) + optional top-ups ₹50,000 and
//    ₹25,000 during the auction → ₹2,50,000 at most
//  - squad 18–20 including owners; age above 30 and below 35: max 3 bought
//  - category mixes (0 A+ · 6 A · 6 B, 1 A+ · 5 A · 6 B, or 2 A+ · 3 A · 7 B, + 1 Legend) apply to
//    the match-day XII, not to buying — so no category caps on purchase.
// Mirrors auction_rules for the USCL season.
const USCL_RULES: Rules = {
  squadMin: 18,
  squadMax: 20,
  maxBid: 250000,
  minIncrement: 1000,
  base: { "A+": 20000, A: 10000, B: 6000, Special: 3000 },
  cap: { "A+": 20, A: 20, B: 20, Special: 20 },
  step: { "A+": 5000, A: 3000, B: 2000, Special: 1000 },
};

/** USCL purse: starting amount and the two optional top-ups (rulebook p.4). */
export const USCL_PURSE = { start: 175000, topUps: [50000, 25000] };
/** USCL rulebook: buyers aged above 30 and below 35 — max 3 per squad (2 may play). */
export const USCL_AGE_BAND = { min: 31, max: 34, buyMax: 3, playMax: 2 };
export const inAgeBand = (age: number | null | undefined) => age != null && age >= USCL_AGE_BAND.min && age <= USCL_AGE_BAND.max;

export const DEFAULT_RULES: Rules = LEAGUE === "uscl" ? USCL_RULES : SDLL_RULES;

/** USCL: how many A players a squad may hold given its A+ count (deck p.4). */
// USCL deck, "Owners & Retention Rules": owner picks cost the category base
// (A+ 20K · A 10K · B/Legend 3K); retentions cost more.
export const USCL_RETAIN: Record<AuctionCategory, number> = { "A+": 25000, A: 15000, B: 6000, Special: 3000 };
export const USCL_OWNER: Record<AuctionCategory, number> = { "A+": 20000, A: 10000, B: 3000, Special: 3000 };

/** One bid step for a category (USCL: per category; SDLL: flat). */
export const bidStep = (c: string | null | undefined, r: Rules = DEFAULT_RULES) =>
  r.step?.[normCategory(c) ?? "B"] ?? r.minIncrement;

export const usclACap = (aPlus: number) => (aPlus >= 2 ? 3 : aPlus === 1 ? 5 : 6);

export const basePriceFor = (c: string | null | undefined, r: Rules = DEFAULT_RULES) =>
  r.base[normCategory(c) ?? "B"];

export const categoryCap = (c: string | null | undefined, r: Rules = DEFAULT_RULES) =>
  r.cap[normCategory(c) ?? "B"];

export const inr = (n: number | null | undefined) =>
  "₹" + Math.round(n || 0).toLocaleString("en-IN");

/** Quick-raise ladder — coarser as the price climbs, the way a room bids. */
export function raiseSteps(current: number | null, base: number, r: Rules = DEFAULT_RULES, category?: string | null) {
  const from = current ?? base;
  const step = r.step ? bidStep(category, r) : from < 20000 ? r.minIncrement : from < 50000 ? 1000 : 2500;
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
