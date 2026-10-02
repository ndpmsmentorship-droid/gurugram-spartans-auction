import cvMap from "@/data/cv-map.json";

// Pool name -> the player's page in the CricVideos ball library, when he is on
// film there (scripts/build-cv-map.py). Bowling clips first: that is what an
// auction call usually turns on.
const CV = cvMap as Record<string, { batter?: string; bowler?: string }>;

export function clipsUrl(fullName: string | null | undefined): string | null {
  const lib = fullName ? CV[fullName] : undefined;
  const kind = lib?.bowler ? "bowler" : lib?.batter ? "batter" : null;
  return kind ? `https://www.ndpms.in/spartans/?p=${kind}-${encodeURIComponent(lib![kind]!)}&from=uscl` : null;
}
