/**
 * LOCAL DESIGN FIXTURE — only ever used when SPARTANS_DEV_FIXTURE=1.
 *
 * The redesign work needs the Pool and Profile screens rendering with realistic
 * shapes (long names, missing stats, marquee stars, sold rows, thin samples)
 * without handing a laptop the production service-role key. Nothing here is
 * imported unless the flag is set, and the flag is never set in production.
 *
 * Deterministic: a tiny seeded PRNG so every reload — and every screenshot
 * diff — produces the identical pool.
 */

import type { ScoutPlayerRow } from "@/lib/supabase/types";

// mulberry32 — deterministic, no dependency
function rng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  "Aditya", "Rahul", "Vikram", "Dheeraj", "Vinesh", "Pritam", "Amrinder", "Karamvir",
  "Dishant", "Pradeep", "Russell", "Vibhu", "Viqar", "Vishal", "Sumit", "Nakshatra",
  "Deepak", "Gautam", "Kshitij", "Mayank", "Hardeep", "Rohit", "Sachin", "Ashish",
  "Piyush", "Nikhil", "Aman", "Sooraj", "Ishal", "Keshav", "Harbir", "Peeyush",
  "Sandeep", "Sarjeet", "Saurabh", "Anjum", "Gavender", "Dipak", "Jasminder", "Madhav",
  "Shahid", "Narendra", "Sanjay", "Jagrit", "Neeraj", "Wasim", "Harchit", "Ramit",
  "Ajay", "Gurvir", "Nitin", "Rahul", "Rishabh", "Sameer", "Jayant", "Parveen",
  "Hitesh", "Shakib", "Shubhendu", "Ankit", "Vikas", "Ganesh", "Abhinav", "Dinkar",
  "Kanishk", "Sunny", "Sourav", "Himanshu", "Yatin", "Vinay", "Kanwar", "Parichit",
];
const LAST = [
  "Kumar", "Tomar", "Thakur", "Kataria", "Singh", "Lall", "Dey", "Mahlawat",
  "Stamets", "Gaur", "Najar", "Salgotra", "Sharma", "Talwar", "Begraj", "Maini",
  "Kharb", "Rathi", "Malik", "Rohilla", "Jangra", "Dudi", "Arora", "Jhingon",
  "Bhalla", "lakhanpal", "Basi", "K B", "Sunny", "Chhabra", "Khan", "Dubey",
  "Anand", "Puri", "Ahmed", "Sanan", "Gill", "Mahajan", "Tandan", "Batra",
  "Pawar", "Bhalla", "Yadav", "Hussain", "Kaushik", "Bajpai", "Grover", "Jain",
  "Sheel", "Girotra", "Suneja", "Tanwar", "Dhingra", "Narang", "Pal", "Chauhan",
];

const ROLES = [
  "Batter", "Bowler", "All-rounder", "Batting All-rounder", "Bowling All-rounder",
  "Wicket Keeper", "Keeper-batter",
];
const BAT_STYLES = ["Right Handed Bat", "Left Handed Bat"];
const BOWL_STYLES = [
  "Right-arm medium", "Right-arm fast", "Right-arm off-break", "Left-arm orthodox",
  "Left-arm medium", "Right-arm leg-break", null,
];
const TIERS = ["U35A", "35+A", "U35B", "35+B"];
const TEAM_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
];

const COUNT = 240;

function uuid(i: number) {
  const h = (i + 1).toString(16).padStart(12, "0");
  return `aaaaaaaa-bbbb-4ccc-8ddd-${h}`;
}

let cached: ScoutPlayerRow[] | null = null;

export function fixturePlayers(): ScoutPlayerRow[] {
  if (cached) return cached;
  const r = rng(20260813);
  const rows: ScoutPlayerRow[] = [];

  for (let i = 0; i < COUNT; i++) {
    const role = ROLES[Math.floor(r() * ROLES.length)];
    const isKeeper = role.toLowerCase().includes("keep");
    const isAllr = role.toLowerCase().includes("all");
    const bats = isAllr || !role.toLowerCase().includes("bowl");
    const bowls = isAllr || role.toLowerCase().includes("bowl") || r() < 0.35;

    // career volume — a long tail of thin-sample players so the sample gates
    // in scout/page.tsx actually get exercised
    const bigCareer = r() < 0.55;
    const batMatches = bigCareer ? 60 + Math.floor(r() * 1150) : Math.floor(r() * 30);
    const batInnings = Math.floor(batMatches * (0.75 + r() * 0.2));
    const runs = bats ? Math.floor(batInnings * (8 + r() * 30)) : Math.floor(batInnings * (2 + r() * 6));
    const notOut = Math.floor(batInnings * (0.05 + r() * 0.18));
    const batAvg = batInnings > notOut ? runs / (batInnings - notOut) : null;
    const batSr = batInnings > 0 ? 85 + r() * 105 : null;
    const fours = Math.floor((runs * (0.22 + r() * 0.2)) / 4);
    const sixes = Math.floor((runs * (0.08 + r() * 0.16)) / 6);

    const bowlMatches = bowls ? (bigCareer ? 40 + Math.floor(r() * 900) : Math.floor(r() * 25)) : 0;
    const overs = bowls ? Math.round(bowlMatches * (1.2 + r() * 2.2)) : null;
    const wickets = bowls ? Math.floor((overs ?? 0) * (0.15 + r() * 0.35)) : null;
    const bowlRuns = bowls ? Math.floor((overs ?? 0) * (5 + r() * 4)) : null;
    const economy = bowls && overs ? (bowlRuns ?? 0) / overs : null;
    const dotBalls = bowls && overs ? Math.floor(overs * 6 * (0.3 + r() * 0.28)) : null;

    const matches = Math.max(batMatches, bowlMatches);
    const catches = Math.floor(matches * (0.15 + r() * 0.4));
    const runOuts = Math.floor(matches * (0.02 + r() * 0.1));
    const stumpings = isKeeper ? Math.floor(matches * (0.05 + r() * 0.15)) : null;

    const batIndex = bats ? Math.round((28 + r() * 68) * 10) / 10 : Math.round(r() * 40 * 10) / 10;
    const bowlIndex = bowls ? Math.round((25 + r() * 70) * 10) / 10 : Math.round(r() * 25 * 10) / 10;
    const fieldIndex = Math.round((20 + r() * 75) * 10) / 10;
    const keepIndex = isKeeper ? Math.round((45 + r() * 50) * 10) / 10 : Math.round(r() * 35 * 10) / 10;
    const overall =
      Math.min(
        100,
        Math.round(
          (batIndex * (bats ? 0.42 : 0.15) +
            bowlIndex * (bowls ? 0.34 : 0.1) +
            fieldIndex * 0.16 +
            keepIndex * (isKeeper ? 0.2 : 0.04)) *
            (1 / (bats && bowls ? 0.92 : 0.78)) *
            10
        ) / 10
      );

    // ~28% already sold, so the Sold/Unsold filter and the sold row tint show up
    const sold = r() < 0.28;

    rows.push({
      id: uuid(i),
      full_name: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`,
      primary_role: role,
      batting_style: BAT_STYLES[Math.floor(r() * BAT_STYLES.length)],
      bowling_style: bowls ? BOWL_STYLES[Math.floor(r() * (BOWL_STYLES.length - 1))] : null,
      auction_category: TIERS[Math.floor(r() * TIERS.length)],
      photo_url: null,
      cricheroes_link: r() < 0.7 ? "https://cricheroes.in/player-profile/000000/demo" : null,
      email: null,
      phone: null,
      highest_score: bats ? `${Math.floor(40 + r() * 160)}${r() < 0.4 ? "*" : ""}` : null,
      is_keeper: isKeeper,
      is_bought: sold,
      is_rejected: r() < 0.04,
      is_marquee: r() < 0.05,
      reg_status: r() < 0.86 ? "registered" : r() < 0.95 ? "verified" : "rejected",
      utility_tag: null,
      scout_category: null,
      scouting_clip_url: null,
      scouting_note: r() < 0.08 ? "Strong through the covers; struggles against genuine pace early." : null,
      created_at: "2026-07-01T00:00:00.000Z",

      age: 22 + Math.floor(r() * 26),
      bat_matches: batMatches,
      bat_innings: batInnings,
      not_out: notOut,
      runs,
      bat_avg: batAvg == null ? null : Math.round(batAvg * 100) / 100,
      bat_sr: batSr == null ? null : Math.round(batSr * 10) / 10,
      fifties: Math.floor(runs / 900),
      hundreds: Math.floor(runs / 4200),
      fours,
      sixes,
      ducks: Math.floor(batInnings * 0.04),
      bowl_matches: bowlMatches,
      bowl_innings: bowlMatches,
      overs,
      maidens: bowls ? Math.floor((overs ?? 0) * 0.03) : null,
      wickets,
      bowl_runs: bowlRuns,
      economy: economy == null ? null : Math.round(economy * 100) / 100,
      bowl_avg: wickets ? Math.round(((bowlRuns ?? 0) / wickets) * 100) / 100 : null,
      bowl_sr: wickets ? Math.round((((overs ?? 0) * 6) / wickets) * 10) / 10 : null,
      three_w: bowls ? Math.floor((wickets ?? 0) / 22) : null,
      five_w: bowls ? Math.floor((wickets ?? 0) / 90) : null,
      dot_balls: dotBalls,
      // left null on a slice of players so the "Conc%" blank path is exercised
      bowl_fours: bowls && r() < 0.75 ? Math.floor((overs ?? 0) * (0.35 + r() * 0.4)) : null,
      bowl_sixes: bowls && r() < 0.75 ? Math.floor((overs ?? 0) * (0.12 + r() * 0.2)) : null,
      wides: bowls ? Math.floor((overs ?? 0) * 0.2) : null,
      noballs: bowls ? Math.floor((overs ?? 0) * 0.04) : null,
      catches,
      run_outs: runOuts,
      stumpings,
      keeping_catches: isKeeper ? Math.floor(matches * 0.2) : null,
      bat_index: batIndex,
      bowl_index: bowlIndex,
      field_index: fieldIndex,
      keep_index: keepIndex,
      overall_index: overall,
      bought_price: sold ? [6000, 10000, 15000, 20000, 25000, 35000, 55000, 65000, 100000][Math.floor(r() * 9)] : null,
      suggested_batting_order: null,
      recent_bat_innings: r() < 0.6 ? Math.floor(batInnings * 0.15) : null,
      recent_not_out: null,
      recent_runs: r() < 0.6 ? Math.floor(runs * 0.16) : null,
      recent_bat_avg: r() < 0.6 ? Math.round((15 + r() * 35) * 10) / 10 : null,
      recent_bat_sr: r() < 0.6 ? Math.round((95 + r() * 90) * 10) / 10 : null,
      recent_fours: null,
      recent_sixes: null,
      recent_bowl_matches: null,
      recent_wickets: r() < 0.5 && bowls ? Math.floor((wickets ?? 0) * 0.15) : null,
      recent_economy: r() < 0.5 && bowls ? Math.round((6 + r() * 3) * 100) / 100 : null,
      recent_bowl_avg: null,
      recent_bowl_sr: null,
    } as ScoutPlayerRow & { team_id: string | null; sold_price: number | null; acquired: string | null });

    // the board/squad views read these three columns off the same row
    const last = rows[rows.length - 1] as ScoutPlayerRow & {
      team_id: string | null;
      sold_price: number | null;
      acquired: string | null;
    };
    last.team_id = sold ? TEAM_IDS[Math.floor(r() * TEAM_IDS.length)] : null;
    last.sold_price = sold ? last.bought_price : null;
    last.acquired = sold ? (r() < 0.15 ? "retained" : "auction") : null;
  }

  cached = rows;
  return rows;
}

export const FIXTURE_SEASON = { id: "5eaa0000-0000-4000-8000-000000000001", is_active: true, name: "Season 1" };

export const FIXTURE_TEAMS = [
  { id: TEAM_IDS[0], name: "Bengal Tigers", division: "Elite", purse_total: 400000, season_id: FIXTURE_SEASON.id },
  { id: TEAM_IDS[1], name: "Goa Monks", division: "Elite", purse_total: 400000, season_id: FIXTURE_SEASON.id },
  { id: TEAM_IDS[2], name: "Jaipur Royals", division: "Challengers", purse_total: 400000, season_id: FIXTURE_SEASON.id },
  { id: TEAM_IDS[3], name: "UP Warriors", division: "Challengers", purse_total: 400000, season_id: FIXTURE_SEASON.id },
];

// A signed-in admin, so the gated Pool page and the admin-only profile controls
// both render while designing.
export const FIXTURE_PROFILE = {
  id: "00000000-0000-4000-8000-00000000cafe",
  role: "admin",
  full_name: "Design Preview",
  email: "design@localhost",
};
