"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Thin red bar across the top that starts the moment an internal link is
// tapped and finishes when the new page arrives. Clients on phones were
// tapping links repeatedly because nothing visibly happened while the server
// worked; this acknowledges the tap immediately.
export default function NavProgress() {
  const pathname = usePathname();
  // The page the tap happened on. The bar is active only while we're still
  // there, so arriving at the new page clears it without an effect.
  const [from, setFrom] = useState<string | null>(null);
  const active = from !== null && from === pathname;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page / #anchor
      // usePathname() omits the basePath, so strip it to compare like for like.
      setFrom(location.pathname.replace(/^\/spartansscout(?=\/|$)/, "") || "/");
    }
    // Back/forward: clear, so returning to the tapped-from page never shows it.
    const reset = () => setFrom(null);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", reset);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", reset);
    };
  }, []);

  // Safety net: never leave the bar stuck if a navigation is abandoned.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setFrom(null), 12000);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]">
      <div
        className="h-full bg-[var(--red)] shadow-[0_0_8px_var(--red)]"
        style={{
          width: active ? "85%" : "0%",
          opacity: active ? 1 : 0,
          transition: active ? "width 8s cubic-bezier(.1,.7,.2,1), opacity .1s" : "opacity .25s",
        }}
      />
    </div>
  );
}
