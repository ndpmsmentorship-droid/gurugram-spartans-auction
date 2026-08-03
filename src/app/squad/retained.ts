// Auto-generated from the Season-5 SCCL export (career stats) + the owner's
// retention plan. The Gurugram Spartans' pre-auction core: these five are locked
// in before bidding opens. Edit the numbers/roles here if the plan changes.
export type Tier = "A" | "B" | "Legend";

export type RetainedPlayer = {
  id: string;
  name: string;
  tier: Tier;
  role: string;
  order: string;
  slot: number;
  isCaptain: boolean;
  isKeeper: boolean;
  tagline: string;
  photo: string | null;
  cricheroes: string | null;
  bat: { matches: number; runs: number; avg: number; sr: number; fifties: number; hundreds: number };
  bowl: { wickets: number; econ: number };
  field: { catches: number; stumpings: number };
};

export const SQUAD_RULES = { maxCategoryA: 6, minSquad: 16 } as const;

export const RETAINED: RetainedPlayer[] = [
  {
    "id": "944570",
    "name": "Nitin Rao",
    "tier": "A",
    "role": "Batting Allrounder",
    "order": "Top order",
    "slot": 1,
    "isCaptain": false,
    "isKeeper": false,
    "tagline": "Explosive top-order all-rounder",
    "photo": "https://media.cricheroes.in/user_profile/1758192457753_Xi0ntF2LBPLw.jpeg?width=3840&quality=75&format=auto",
    "cricheroes": "https://cricheroes.in/player-profile/944570/Nitin",
    "bat": {
      "matches": 575,
      "runs": 17777,
      "avg": 42.33,
      "sr": 194.5,
      "fifties": 89,
      "hundreds": 38
    },
    "bowl": {
      "wickets": 358,
      "econ": 7.99
    },
    "field": {
      "catches": 264,
      "stumpings": 20
    }
  },
  {
    "id": "13619012",
    "name": "Kanishk Sheel",
    "tier": "Legend",
    "role": "blank",
    "order": "No. 3",
    "slot": 3,
    "isCaptain": true,
    "isKeeper": false,
    "tagline": "Captain · Legend signing",
    "photo": "https://media.cricheroes.in/user_profile/1733024746211_bJO36vXv9sJH.jpg?width=3840&quality=75&format=auto",
    "cricheroes": "https://cricheroes.com/player-profile/13619012/kanishk-sheel",
    "bat": {
      "matches": 67,
      "runs": 173,
      "avg": 5.09,
      "sr": 68.65,
      "fifties": 0,
      "hundreds": 0
    },
    "bowl": {
      "wickets": 59,
      "econ": 10.91
    },
    "field": {
      "catches": 2,
      "stumpings": 0
    }
  },
  {
    "id": "1299729",
    "name": "Vikas Grover",
    "tier": "A",
    "role": "Batting Allrounder",
    "order": "Middle order",
    "slot": 4,
    "isCaptain": false,
    "isKeeper": false,
    "tagline": "All-round engine of the side",
    "photo": "https://media.cricheroes.in/user_profile/1669483279903_FCmbM0iTSY6f.jpg?width=3840&quality=75&format=auto",
    "cricheroes": "https://cricheroes.com/player-profile/1299729/Vikas-10",
    "bat": {
      "matches": 555,
      "runs": 19777,
      "avg": 44.34,
      "sr": 169.19,
      "fifties": 130,
      "hundreds": 32
    },
    "bowl": {
      "wickets": 543,
      "econ": 7.1
    },
    "field": {
      "catches": 259,
      "stumpings": 0
    }
  },
  {
    "id": "752063",
    "name": "Nikhil Dhingra",
    "tier": "B",
    "role": "blank",
    "order": "Middle order",
    "slot": 5,
    "isCaptain": false,
    "isKeeper": true,
    "tagline": "Wicketkeeper · owner",
    "photo": null,
    "cricheroes": "https://cricheroes.com/player-profile/752063/nikhil-dhingra",
    "bat": {
      "matches": 718,
      "runs": 12669,
      "avg": 26.84,
      "sr": 122.57,
      "fifties": 52,
      "hundreds": 5
    },
    "bowl": {
      "wickets": 79,
      "econ": 11.54
    },
    "field": {
      "catches": 99,
      "stumpings": 332
    }
  },
  {
    "id": "5799951",
    "name": "Abhinav Jain",
    "tier": "B",
    "role": "Batting Allrounder",
    "order": "Middle order",
    "slot": 6,
    "isCaptain": false,
    "isKeeper": false,
    "tagline": "Middle-order all-rounder",
    "photo": "https://media.cricheroes.in/user_profile/1743840594972_214rXLnZwfzX.jpeg?width=3840&quality=75&format=auto",
    "cricheroes": "https://cricheroes.in/player-profile/5799951/Abhinav-Jain",
    "bat": {
      "matches": 206,
      "runs": 5785,
      "avg": 39.62,
      "sr": 131.51,
      "fifties": 42,
      "hundreds": 1
    },
    "bowl": {
      "wickets": 167,
      "econ": 8.28
    },
    "field": {
      "catches": 111,
      "stumpings": 2
    }
  }
];
