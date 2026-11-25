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
  plan: { seasonId: string; profileId: string; team: PlanTeam; players: PoolPlayer[]; leagueName?: string };
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
              {t.key === "live" && <span className="ml-1.5 rounded-full bg-gold-fill px-1.5 py-0.5 align-middle text-[0.6rem] font-semibold uppercase tracking-wide text-gold">soon</span>}
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
          {/* Work in progress for owners until auction night is ready (Nikhil, 25 Nov 2026); the league admin still sees it. */}
          {warRoom.canRecord ? (
            <>
              <p className="mx-auto mb-3 max-w-[1280px] rounded-[10px] border border-dashed border-gold-line bg-gold-fill px-3 py-2 text-[0.78rem] text-gold">
                Work in progress — owners see a &ldquo;coming soon&rdquo; page here; only the league admin sees the War Room.
              </p>
              <WarRoom {...warRoom} onSnapshot={(read) => (snapshot.current = read)} />
            </>
          ) : (
            <section className="mx-auto max-w-[640px] rounded-[18px] border border-line bg-surface p-6 text-center shadow-[var(--elev-sm)] sm:p-10">
              <p className="eyebrow">War Room · work in progress</p>
              <h2 className="mt-2 font-display text-3xl font-bold uppercase leading-tight">Your auction-night console</h2>
              <p className="mx-auto mt-3 max-w-[46ch] text-sm text-muted">
                Purse, open slots, the player on the block and who can still afford him — live on auction night, Sat 19 Dec. We&rsquo;re still building it and will open it before the auction.
              </p>
              <p className="mx-auto mt-2 max-w-[46ch] text-sm text-muted">Until then, build your squad of 18 on the Plan tab and keep an eye on the Live pool.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setTab("plan")} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
                  Plan your squad
                </button>
                <button type="button" onClick={() => setTab("pool")} className="rounded-full border border-line px-5 py-2.5 text-sm font-medium">
                  Live pool
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      <AIChat snapshot={() => snapshot.current?.() ?? ""} />
    </main>
  );
}
