import type { NextConfig } from "next";

// Served under www.ndpms.in/spartansscout (a rewrite on the ndpms.in LMS proxies
// that path to this deployment, which also serves everything under the same
// basePath). basePath auto-prefixes Link/redirect/assets.
const nextConfig: NextConfig = {
  basePath: "/spartansscout",
  // Also served on its own subdomain, sdll.playfulventures.co.in (no rewrite
  // there), so the bare host forwards to the app. ndpms.in only proxies
  // /spartansscout here, so this never fires for it.
  async redirects() {
    return [
      { source: "/", destination: "/spartansscout", basePath: false, permanent: false },
    ];
  },
  // Player headshots live on the SCCL dashboard, which sends
  // Cross-Origin-Resource-Policy: same-origin (blocks direct <img> embedding).
  // Routing them through next/image re-serves them from our own origin.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "sarda-corporate-league.anantanity.com",
        pathname: "/public/**",
      },
      // SDLL registration photos (import-sdll.mts) live on these two hosts.
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/dlz7ypjrl/**",
      },
      {
        protocol: "https",
        hostname: "media.cricheroes.in",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
