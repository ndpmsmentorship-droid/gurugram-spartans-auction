import type { NextConfig } from "next";

// Served under www.ndpms.in/spartansscout (a rewrite on the ndpms.in LMS proxies
// that path to this deployment, which also serves everything under the same
// basePath). basePath auto-prefixes Link/redirect/assets.
const nextConfig: NextConfig = {
  basePath: "/spartansscout",
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
    ],
  },
};

export default nextConfig;
