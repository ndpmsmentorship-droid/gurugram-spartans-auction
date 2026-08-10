"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// While any tab is open, mirror the live auction from Anantanity into our board
// every 5 minutes (server route is rate-limited to once/60s). No UI.
export default function AuctionSync() {
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      try {
        const res = await fetch("/spartansscout/api/sync-auction", { cache: "no-store" });
        const j = await res.json().catch(() => null);
        if (alive && j?.ok && (j.updated || j.cleared)) router.refresh();
      } catch {
        /* offline / transient — ignore, try again next tick */
      }
    };
    sync();
    const id = setInterval(sync, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [router]);
  return null;
}
