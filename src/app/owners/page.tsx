import type { Metadata } from "next";
import OwnersPortal from "../war-room/page";

// playfulventures.co.in/owners (Nikhil, 27 Nov 2026): the owners' portal itself — three tabs, Plan,
// Live pool and War Zone (coming soon), and nothing else. Same page as /war-room; the old owners'
// home (team cards, squad, purse tiles, AI scout card) is in git history before this change.
export const metadata: Metadata = { title: "Owners’ portal" };
export const dynamic = "force-dynamic";
export default OwnersPortal;
