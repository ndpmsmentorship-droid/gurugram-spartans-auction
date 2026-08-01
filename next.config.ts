import type { NextConfig } from "next";

// Served under www.ndpms.in/spartansscout (a rewrite on the ndpms.in LMS proxies
// that path to this deployment, which also serves everything under the same
// basePath). basePath auto-prefixes Link/redirect/assets.
const nextConfig: NextConfig = {
  basePath: "/spartansscout",
};

export default nextConfig;
