"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; external?: boolean };

// Centred pill nav from the design comps. usePathname() returns the path
// WITHOUT the /spartansscout basePath, so these compare cleanly.
export default function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((it) => {
        if (it.external) {
          return (
            <a
              key={it.href}
              href={it.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full px-3.5 py-2 font-mono text-[0.688rem] uppercase tracking-[0.12em] text-white/60 transition hover:text-white"
            >
              {it.label} ↗
            </a>
          );
        }
        const active =
          it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            data-active={active}
            className="rounded-full border border-transparent px-3.5 py-2 font-mono text-[0.688rem] uppercase tracking-[0.12em] text-white/60 transition hover:text-white data-[active=true]:border-white/20 data-[active=true]:bg-white/12 data-[active=true]:text-white"
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
