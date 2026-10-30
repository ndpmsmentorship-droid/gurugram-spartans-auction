"use client";

import { useEffect, useRef, useState } from "react";
import WarRoom from "./WarRoom";
import OwnerPlan, { type PlanTeam, type PoolPlayer } from "./OwnerPlan";
import LivePool from "./LivePool";
import AIChat from "./AIChat";

// One page for the whole auction: plan the squad, watch the pool fill up, run
// auction night — so owners learn the War Room while they plan. All three
// stay mounted, so switching tabs never loses live state.
export type PortalTab = "plan" | "pool" | "live";
const TABS: { key: PortalTab; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "pool", label: "Live pool" },
  { key: "live", label: "War Room" },
];

export default function OwnerPortal({
  tab: initial,
  warRoom,
  plan,
}: {
  tab: PortalTab;
  warRoom: Omit<React.ComponentProps<typeof WarRoom>, "onSnapshot">;
  plan: { seasonId: string; profileId: string; team: PlanTeam; players: PoolPlayer[] };
}) {
  const [tab, setTab] = useState<PortalTab>(initial);
  const snapshot = useRef<(() => string) | null>(null);

  // Keep the address in step so a refresh or a shared link opens the same tab.
  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.set("tab", tab);
    window.history.replaceState(null, "", u);
  }, [tab]);

  return (
    <main className="flex-1">
      <nav className="sticky top-16 z-20 border-b border-line bg-background/95 backdrop-blur" aria-label="Owners’ portal">
        <div className="mx-auto flex max-w-[1280px] gap-1 px-3 py-2 sm:px-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-medium sm:flex-none sm:px-5 ${tab === t.key ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="px-3 py-5 sm:px-6">
        <div hidden={tab !== "plan"}>
          <OwnerPlan {...plan} />
        </div>
        <div hidden={tab !== "pool"}>
          <LivePool />
        </div>
        <div hidden={tab !== "live"}>
          <WarRoom {...warRoom} onSnapshot={(read) => (snapshot.current = read)} />
        </div>
      </div>

      <AIChat snapshot={() => snapshot.current?.() ?? ""} />
    </main>
  );
}
