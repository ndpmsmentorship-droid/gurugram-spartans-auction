"use client";

import Image, { type StaticImageData } from "next/image";
import { useCallback, useEffect, useState } from "react";

export type Photo = { src: StaticImageData; caption: string };

// Photo grid with a full-screen viewer: tap a photo to open it, arrows or
// swipe-free buttons to move, Esc or the backdrop to close.
export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const n = photos.length;
  const go = useCallback((d: number) => setOpen((v) => (v === null ? v : (v + d + n) % n)), [n]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, go]);

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {photos.map((p, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="group relative block aspect-[3/2] w-full overflow-hidden rounded-[12px] border border-line"
              aria-label={`Open photo: ${p.caption}`}
            >
              <Image
                src={p.src}
                alt={p.caption}
                fill
                sizes="(max-width: 768px) 50vw, 380px"
                className="object-cover transition duration-500 group-hover:scale-[1.04]"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8 text-left text-[0.75rem] text-white opacity-0 transition group-hover:opacity-100">
                {p.caption}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(null)}
        >
          <figure className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <Image
              src={photos[open].src}
              alt={photos[open].caption}
              className="h-auto max-h-[80vh] w-full rounded-[10px] object-contain"
              sizes="100vw"
            />
            <figcaption className="mt-3 flex items-center justify-between gap-3 text-sm text-white/80">
              <span>{photos[open].caption}</span>
              <span className="num text-white/50">
                {open + 1} / {n}
              </span>
            </figcaption>
          </figure>
          {n > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={(e) => (e.stopPropagation(), go(-1))}
                className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={(e) => (e.stopPropagation(), go(1))}
                className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
              >
                ›
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(null)}
            className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-xl text-white hover:bg-white/25"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
