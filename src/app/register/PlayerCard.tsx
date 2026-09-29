"use client";

import Image from "next/image";
import { useState } from "react";
import type { CardProfile } from "./actions";

// Hosts next/image may proxy (see next.config.ts). The SARDA host blocks direct
// embedding (Cross-Origin-Resource-Policy), so its photos MUST go through
// next/image; anything else falls back to a plain <img>.
const PROXIED = ["sarda-corporate-league.anantanity.com", "res.cloudinary.com", "media.cricheroes.in"];

export function prettyRole(r: string | null): string | null {
  if (!r) return null;
  const t = r.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return t === "All Rounder" ? "All-rounder" : t;
}

export function PlayerPhoto({
  src,
  name,
  className,
  sizes,
}: {
  src: string | null;
  name: string;
  className: string;
  sizes: string;
}) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  let host = "";
  try {
    host = src ? new URL(src).hostname : "";
  } catch {}

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-b from-[#4d1310] to-[#250201] ${className}`}
    >
      {src && !broken ? (
        PROXIED.includes(host) ? (
          <Image src={src} alt="" fill sizes={sizes} className="object-cover object-top" onError={() => setBroken(true)} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover object-top" onError={() => setBroken(true)} />
        )
      ) : (
        <span className="absolute inset-0 grid place-items-center font-display text-4xl text-white/80">
          {initials}
        </span>
      )}
    </div>
  );
}

const STAT_LABELS: [string, string][] = [
  ["matches", "Matches"],
  ["runs", "Runs"],
  ["bat_avg", "Bat avg"],
  ["bat_sr", "Strike rate"],
  ["wickets", "Wickets"],
  ["economy", "Economy"],
];

export default function PlayerCard({ p }: { p: CardProfile }) {
  const stats = STAT_LABELS.filter(([k]) => p.stats?.[k] !== undefined && p.stats?.[k] !== null);
  const styles = [p.batting_style, p.bowling_style].filter(Boolean).join(" · ");
  const played = (p.seasons ?? []).filter((s) => !/pool/i.test(s));

  return (
    <div className="overflow-hidden rounded-[16px] border border-line bg-surface shadow-[var(--elev)]">
      <div className="grid sm:grid-cols-[220px_1fr]">
        <PlayerPhoto
          src={p.photo_url}
          name={p.full_name}
          className="aspect-[4/5] w-full sm:aspect-auto sm:h-full sm:min-h-[280px]"
          sizes="(max-width: 640px) 100vw, 220px"
        />
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div>
            <p className="eyebrow">{[p.last_team, played.join(" · ")].filter(Boolean).join(" · ") || "Returning player"}</p>
            <h2 className="mt-2 text-3xl leading-none sm:text-4xl">{p.full_name}</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {p.is_owner && (
              <span className="badge border border-gold-line bg-gold-fill text-gold">
                ★ Team owner{p.last_team ? ` · ${p.last_team}` : ""}
              </span>
            )}
            {p.category && <span className="badge bg-wash text-ink">Category {p.category}</span>}
            {prettyRole(p.primary_role) && <span className="badge bg-wash text-ink">{prettyRole(p.primary_role)}</span>}
          </div>

          {styles && <p className="text-sm text-muted">{styles}</p>}

          {stats.length > 0 && (
            <dl className="mt-auto grid grid-cols-3 gap-2 sm:grid-cols-6">
              {stats.map(([k, label]) => (
                <div key={k} className="tile px-2 py-2.5 text-center">
                  <dd className="num text-lg font-medium text-ink">{p.stats![k]}</dd>
                  <dt className="label-mono mt-1">{label}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
