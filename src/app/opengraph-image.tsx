import { ImageResponse } from "next/og";

export const alt = "Spartans Scout — auction analytics for The Gurugram Spartans";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Helmet badge (same mark as the favicon) as an inline data URI.
const HELMET = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6CB49"/><stop offset="1" stop-color="#D2911F"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="#17171A"/><g fill="url(#g)"><path d="M32 4.5 C39 9.5 40.5 16 37 21.5 L27 21.5 C23.5 16 25 9.5 32 4.5 Z"/><path fill-rule="evenodd" d="M32 17 C44.5 17 51.5 24.5 51.5 33.5 C51.5 45 43 54 32 58 C21 54 12.5 45 12.5 33.5 C12.5 24.5 19.5 17 32 17 Z M17 31.5 C19.8 27.6 26 27.6 28.7 30.2 C26 32 19.8 33 17 31.5 Z M47 31.5 C44.2 27.6 38 27.6 35.3 30.2 C38 32 44.2 33 47 31.5 Z M29.8 34 L34.2 34 L33.3 50 L30.7 50 Z"/></g></svg>`
)}`;

// Four honours stars: two gold (champions), two silver (runners-up).
const star = (fill: string) =>
  `<path d="M12 2.5l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.9 6.4 19.7l1.3-6.3L2.9 9.1l6.4-.7L12 2.5z" fill="${fill}"/>`;
const STARS = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 24" width="108" height="24">` +
    `<g transform="translate(0,0)">${star("#E3A81B")}</g>` +
    `<g transform="translate(28,0)">${star("#F6CB49")}</g>` +
    `<g transform="translate(56,0)">${star("#9AA0A6")}</g>` +
    `<g transform="translate(84,0)">${star("#C9CED3")}</g></svg>`
)}`;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(1000px 500px at 78% -10%, #2a2410 0%, #0b0b0c 55%), #0b0b0c",
          padding: "72px 80px",
          color: "#f5f5f7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HELMET} width={96} height={96} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 22,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: "#E3A81B",
                fontWeight: 700,
              }}
            >
              The Gurugram Spartans
            </div>
            <div style={{ fontSize: 26, color: "#86868b", marginTop: 4 }}>
              Sarda Corporate Cricket League
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>
            Spartans Scout
          </div>
          <div style={{ fontSize: 40, color: "#c7c7cc", marginTop: 20 }}>
            Rank · analyze · buy players on auction day.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={STARS} width={126} height={28} alt="" />
          <div style={{ fontSize: 26, color: "#86868b" }}>
            Four-time trophy winners · 2× champions
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
