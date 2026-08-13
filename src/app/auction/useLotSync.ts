"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Keep this screen in step with the auctioneer.
 *
 * Realtime is the fast path — a raise should land on every owner's screen in
 * well under a second. The interval is a SAFETY NET, not the mechanism: if the
 * socket drops mid-auction (patchy venue wifi is the norm) the board must not
 * silently freeze on a stale price, so it also re-pulls on a slow timer.
 *
 * Falls back to the timer alone when realtime isn't available — either the
 * local fixture, or a database where live_auction_schema.sql hasn't been run.
 */
export function useLotSync(pollMs = 5000) {
  const router = useRouter();
  const refresh = useRef(() => router.refresh());
  refresh.current = () => router.refresh();

  useEffect(() => {
    const id = setInterval(() => refresh.current(), pollMs);

    let cleanup: (() => void) | undefined;
    try {
      const supabase = createClient();
      const channel = supabase
        .channel("auction-lot")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "auction_lot" },
          () => refresh.current()
        )
        .subscribe();
      cleanup = () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // no realtime configured — the interval above still keeps us honest
    }

    return () => {
      clearInterval(id);
      cleanup?.();
    };
  }, [pollMs]);
}
