// Loads scripts/cleaned_players.json (produced by clean_players_csv.py) into
// Supabase: creates/activates the season, seeds mock competitor teams for
// practice bidding, then inserts players + their season stats.
//
// Usage:
//   node --env-file=.env.local scripts/seed-players.mjs

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const SEASON_NAME = process.env.SEASON_NAME || "Season 4";
const REAL_TEAM_NAME = "Gurugram Spartans";
const MOCK_TEAM_NAMES = ["Mock Team Alpha", "Mock Team Beta", "Mock Team Gamma"];
const DEFAULT_PURSE = 2_000_000;
const DEFAULT_BASE_PRICE = 1_000;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function ensureSeason() {
  const { data: existing, error: findError } = await supabase
    .from("seasons")
    .select("id")
    .eq("name", SEASON_NAME)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("seasons")
    .insert({ name: SEASON_NAME, is_active: true })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function ensureTeams(seasonId) {
  const { data: existing, error: findError } = await supabase
    .from("teams")
    .select("id, name, is_mock")
    .eq("season_id", seasonId);
  if (findError) throw findError;

  const existingNames = new Set(existing.map((t) => t.name));
  const allNames = [REAL_TEAM_NAME, ...MOCK_TEAM_NAMES];
  const toCreate = allNames
    .filter((name) => !existingNames.has(name))
    .map((name) => ({
      season_id: seasonId,
      name,
      is_mock: name !== REAL_TEAM_NAME,
      purse_total: DEFAULT_PURSE,
      purse_remaining: DEFAULT_PURSE,
    }));

  if (toCreate.length > 0) {
    const { error } = await supabase.from("teams").insert(toCreate);
    if (error) throw error;
  }
  console.log(`Teams ready: ${allNames.join(", ")}`);
  console.log(
    `NOTE: link "${REAL_TEAM_NAME}" to your profile after signup:\n` +
      `  update teams set owner_profile_id = '<your-auth-uid>' where name = '${REAL_TEAM_NAME}' and season_id = '${seasonId}';`
  );
}

async function ensureAuctionState(seasonId) {
  const { data: existing, error: findError } = await supabase
    .from("auction_state")
    .select("season_id")
    .eq("season_id", seasonId)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return;

  const { error } = await supabase.from("auction_state").insert({ season_id: seasonId });
  if (error) throw error;
}

async function seedPlayers(seasonId) {
  const raw = await readFile(new URL("./cleaned_players.json", import.meta.url), "utf-8");
  const players = JSON.parse(raw);

  let inserted = 0;
  for (const p of players) {
    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({
        full_name: p.full_name,
        age: p.age,
        email: p.email,
        phone: p.phone,
        linkedin_link: p.linkedin_link,
        cricheroes_link: p.cricheroes_link,
        photo_url: p.photo_url,
        primary_role: p.primary_role,
      })
      .select("id")
      .single();
    if (playerError) throw playerError;

    const { error: statsError } = await supabase.from("player_season_stats").insert({
      player_id: player.id,
      season_id: seasonId,
      base_price: DEFAULT_BASE_PRICE,
      min_price: DEFAULT_BASE_PRICE,
      status: "registered",
      ...p.stats,
    });
    if (statsError) throw statsError;

    inserted += 1;
  }
  console.log(`Seeded ${inserted} players for season "${SEASON_NAME}"`);
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Run with: node --env-file=.env.local scripts/seed-players.mjs");
  }
  const seasonId = await ensureSeason();
  await ensureTeams(seasonId);
  await ensureAuctionState(seasonId);
  await seedPlayers(seasonId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
