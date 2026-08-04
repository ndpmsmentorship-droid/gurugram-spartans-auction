export type Role = "admin" | "owner";

export type PlayerStatus =
  | "registered"
  | "shortlisted"
  | "in_pool"
  | "sold"
  | "unsold";

export type AuctionStatus = "not_started" | "live" | "paused" | "ended";

// ---- Scout tool (auction-day pivot) ----------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used via `typeof` below
const SCOUT_NUMERIC = [
  "age",
  "bat_matches",
  "bat_innings",
  "not_out",
  "runs",
  "bat_avg",
  "bat_sr",
  "fifties",
  "hundreds",
  "fours",
  "sixes",
  "ducks",
  "bowl_matches",
  "bowl_innings",
  "overs",
  "maidens",
  "wickets",
  "bowl_runs",
  "economy",
  "bowl_avg",
  "bowl_sr",
  "three_w",
  "five_w",
  "dot_balls",
  "bowl_fours",
  "bowl_sixes",
  "wides",
  "noballs",
  "catches",
  "run_outs",
  "stumpings",
  "keeping_catches",
  "bat_index",
  "bowl_index",
  "field_index",
  "keep_index",
  "overall_index",
  "bought_price",
  "suggested_batting_order",
  "recent_bat_innings",
  "recent_not_out",
  "recent_runs",
  "recent_bat_avg",
  "recent_bat_sr",
  "recent_fours",
  "recent_sixes",
  "recent_bowl_matches",
  "recent_wickets",
  "recent_economy",
  "recent_bowl_avg",
  "recent_bowl_sr",
] as const;

type ScoutNumericCols = { [K in (typeof SCOUT_NUMERIC)[number]]: number | null };

export type ScoutPlayerRow = ScoutNumericCols & {
  id: string;
  full_name: string;
  primary_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  auction_category: string | null;
  photo_url: string | null;
  cricheroes_link: string | null;
  email: string | null;
  phone: string | null;
  highest_score: string | null;
  is_keeper: boolean;
  is_bought: boolean;
  is_rejected: boolean;
  is_marquee: boolean;
  utility_tag: string | null;
  scout_category: string | null;
  scouting_clip_url: string | null;
  scouting_note: string | null;
  created_at: string;
};

export type ScoutPlayerInsert = Partial<ScoutNumericCols> & {
  id?: string;
  full_name: string;
  primary_role?: string | null;
  batting_style?: string | null;
  bowling_style?: string | null;
  auction_category?: string | null;
  photo_url?: string | null;
  cricheroes_link?: string | null;
  email?: string | null;
  phone?: string | null;
  highest_score?: string | null;
  is_keeper?: boolean;
  is_bought?: boolean;
  is_rejected?: boolean;
  is_marquee?: boolean;
  utility_tag?: string | null;
  scout_category?: string | null;
  scouting_clip_url?: string | null;
  scouting_note?: string | null;
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          role: Role;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          role?: Role;
        };
        Update: Partial<{
          display_name: string;
          role: Role;
        }>;
        Relationships: [];
      };
      seasons: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          name: string;
          is_active?: boolean;
        };
        Update: Partial<{ name: string; is_active: boolean }>;
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          season_id: string;
          name: string;
          owner_profile_id: string | null;
          is_mock: boolean;
          purse_total: number;
          purse_remaining: number;
          logo_url: string | null;
          created_at: string;
        };
        Insert: {
          season_id: string;
          name: string;
          owner_profile_id?: string | null;
          is_mock?: boolean;
          purse_total: number;
          purse_remaining?: number;
          logo_url?: string | null;
        };
        Update: Partial<{
          name: string;
          owner_profile_id: string | null;
          is_mock: boolean;
          purse_total: number;
          purse_remaining: number;
          logo_url: string | null;
        }>;
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          full_name: string;
          age: number | null;
          date_of_birth: string | null;
          email: string | null;
          phone: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          cricheroes_link: string | null;
          linkedin_link: string | null;
          primary_role: string | null;
          batting_style: string | null;
          bowling_style: string | null;
          photo_url: string | null;
          created_at: string;
        };
        Insert: Partial<{
          full_name: string;
          age: number | null;
          date_of_birth: string | null;
          email: string | null;
          phone: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          cricheroes_link: string | null;
          linkedin_link: string | null;
          primary_role: string | null;
          batting_style: string | null;
          bowling_style: string | null;
          photo_url: string | null;
        }> & { full_name: string };
        Update: Partial<{
          full_name: string;
          age: number | null;
          date_of_birth: string | null;
          email: string | null;
          phone: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          cricheroes_link: string | null;
          linkedin_link: string | null;
          primary_role: string | null;
          batting_style: string | null;
          bowling_style: string | null;
          photo_url: string | null;
        }>;
        Relationships: [];
      };
      player_season_stats: {
        Row: {
          id: string;
          player_id: string;
          season_id: string;
          category: string | null;
          base_price: number;
          min_price: number;
          max_price: number | null;
          status: PlayerStatus;
          batting_matches: number | null;
          batting_innings: number | null;
          batting_runs: number | null;
          highest_score: string | null;
          batting_avg: number | null;
          batting_sr: number | null;
          fifties: number | null;
          hundreds: number | null;
          bowling_matches: number | null;
          overs: number | null;
          wickets: number | null;
          best_bowling: string | null;
          economy: number | null;
          bowling_avg: number | null;
          bowling_sr: number | null;
          five_wickets: number | null;
          created_at: string;
        };
        Insert: Partial<{
          category: string | null;
          base_price: number;
          min_price: number;
          max_price: number | null;
          status: PlayerStatus;
          batting_matches: number | null;
          batting_innings: number | null;
          batting_runs: number | null;
          highest_score: string | null;
          batting_avg: number | null;
          batting_sr: number | null;
          fifties: number | null;
          hundreds: number | null;
          bowling_matches: number | null;
          overs: number | null;
          wickets: number | null;
          best_bowling: string | null;
          economy: number | null;
          bowling_avg: number | null;
          bowling_sr: number | null;
          five_wickets: number | null;
        }> & { player_id: string; season_id: string };
        Update: Partial<{
          category: string | null;
          base_price: number;
          min_price: number;
          max_price: number | null;
          status: PlayerStatus;
        }>;
        Relationships: [
          {
            foreignKeyName: "player_season_stats_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      roster_entries: {
        Row: {
          id: string;
          season_id: string;
          player_id: string;
          team_id: string;
          sold_price: number;
          is_captain: boolean;
          is_vice_captain: boolean;
          is_keeper: boolean;
          batting_order: number | null;
          created_at: string;
        };
        Insert: {
          season_id: string;
          player_id: string;
          team_id: string;
          sold_price: number;
          is_captain?: boolean;
          is_vice_captain?: boolean;
          is_keeper?: boolean;
          batting_order?: number | null;
        };
        Update: Partial<{
          team_id: string;
          sold_price: number;
          is_captain: boolean;
          is_vice_captain: boolean;
          is_keeper: boolean;
          batting_order: number | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "roster_entries_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      auction_state: {
        Row: {
          season_id: string;
          current_player_id: string | null;
          current_bid_amount: number | null;
          current_leading_team_id: string | null;
          status: AuctionStatus;
          updated_at: string;
        };
        Insert: {
          season_id: string;
          current_player_id?: string | null;
          current_bid_amount?: number | null;
          current_leading_team_id?: string | null;
          status?: AuctionStatus;
        };
        Update: Partial<{
          current_player_id: string | null;
          current_bid_amount: number | null;
          current_leading_team_id: string | null;
          status: AuctionStatus;
        }>;
        Relationships: [];
      };
      bids: {
        Row: {
          id: string;
          season_id: string;
          player_id: string;
          team_id: string;
          amount: number;
          created_at: string;
        };
        Insert: {
          season_id: string;
          player_id: string;
          team_id: string;
          amount: number;
        };
        Update: Partial<{ amount: number }>;
        Relationships: [];
      };
      scout_players: {
        Row: ScoutPlayerRow;
        Insert: ScoutPlayerInsert;
        Update: Partial<ScoutPlayerInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      place_bid: {
        Args: {
          p_season_id: string;
          p_team_id: string;
          p_amount: number;
        };
        Returns: void;
      };
      mark_current_player_settled: {
        Args: { p_season_id: string };
        Returns: void;
      };
    };
  };
}
