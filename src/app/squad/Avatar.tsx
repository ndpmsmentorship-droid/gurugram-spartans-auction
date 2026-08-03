"use client";

import { useEffect, useRef, useState } from "react";

const GOLD = "#E3A81B";
const GOLD_HI = "#F6CB49";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// Avatar that shows the player's photo when it loads, and cleanly falls back to
// gradient initials when the photo is missing or fails (CricHeroes images are
// often hotlink-blocked on our domain).
export default function Avatar({
  src,
  name,
  size = 44,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // Server-rendered <img> can error before React attaches onError (the event is
  // lost), so also check on mount whether the image already failed to load.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  const dim = { width: size, height: size };

  if (!src || failed) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white"
        style={{
          ...dim,
          fontSize: size * 0.34,
          background: `linear-gradient(145deg, ${GOLD_HI}, ${GOLD})`,
        }}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full object-cover"
      style={{ ...dim, boxShadow: `0 0 0 2px ${GOLD}` }}
    />
  );
}
