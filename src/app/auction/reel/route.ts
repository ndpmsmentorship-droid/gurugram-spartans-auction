import reels from "@/data/ball-reels.json";

// Ball Library highlights for the player on the block, for the hall screen.
// Public like the board itself: the clips are public YouTube streams, and the
// data is built from the library's open manifest (scripts/build-ball-reels.py).
export type ReelBall = { yt: string; s: number; e: number; what: string; vs: string; comp: string };
type Reel = { name: string; balls: ReelBall[] };
const REELS = reels as Record<string, Reel>;

const key = (n: string) => n.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z]/g, "");
const words = (n: string) => n.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z ]/g, "").split(/\s+/).filter(Boolean);

function find(name: string): Reel | null {
  const exact = REELS[key(name)];
  if (exact) return exact;
  // "Karamvir Lall" ~ "Karamvir Singh Lall": first + last word, only if unique.
  const w = words(name);
  if (w.length < 2) return null;
  const hits = Object.values(REELS).filter((r) => {
    const v = words(r.name);
    return v[0] === w[0] && v[v.length - 1] === w[w.length - 1];
  });
  return hits.length === 1 ? hits[0] : null;
}

export function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name")?.trim() ?? "";
  const reel = name ? find(name) : null;
  return Response.json({ balls: reel?.balls ?? [] }, { headers: { "Cache-Control": "public, max-age=300" } });
}
