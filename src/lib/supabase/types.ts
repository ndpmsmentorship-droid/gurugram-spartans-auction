export type Role = "admin" | "owner";

export type PlayerStatus =
  | "registered"
  | "shortlisted"
  | "in_pool"
  | "sold"
  | "unsold";

export type AuctionStatus = "not_started" | "live" | "paused" | "ended";

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
      };
      roster_entries: {
        Row: {
          id: string;
          season_id: string;
          player_id: string;
          team_id: string;
          sold_price: number;
          created_at: string;
        };
        Insert: {
          season_id: string;
          player_id: string;
          team_id: string;
          sold_price: number;
        };
        Update: Partial<{ team_id: string; sold_price: number }>;
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
        Update: never;
      };
    };
  };
}
