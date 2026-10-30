"use client";

import { useCallback, useEffect, useState } from "react";

// An owner's calls on players — "going for him", "hold", "reject" — shared by
// the Plan page and the War Room's live card. Kept on this device only and
// private to the login; nothing reaches other owners or the live board.
export type Call = "going" | "hold" | "reject";

const keyOf = (profileId: string) => `sll-plan-calls:${profileId}`;
const EVENT = "sll-plan-calls";

function read(profileId: string): Record<string, Call> {
  try {
    return JSON.parse(localStorage.getItem(keyOf(profileId)) ?? "{}") as Record<string, Call>;
  } catch {
    return {};
  }
}

export function usePlanCalls(profileId: string) {
  const [calls, setCalls] = useState<Record<string, Call>>({});

  useEffect(() => {
    const sync = () => setCalls(read(profileId));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [profileId]);

  const setCall = useCallback(
    (playerId: string, call: Call | null) => {
      const next = { ...read(profileId) };
      if (!call) delete next[playerId];
      else next[playerId] = call;
      try {
        localStorage.setItem(keyOf(profileId), JSON.stringify(next));
      } catch {
        /* private mode: calls last for this visit only */
      }
      setCalls(next);
      window.dispatchEvent(new Event(EVENT));
    },
    [profileId],
  );

  const going = new Set(Object.keys(calls).filter((k) => calls[k] === "going"));
  const held = new Set(Object.keys(calls).filter((k) => calls[k] === "hold"));
  const rejected = new Set(Object.keys(calls).filter((k) => calls[k] === "reject"));
  return { calls, setCall, going, held, rejected };
}
