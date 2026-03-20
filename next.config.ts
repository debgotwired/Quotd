import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "microphone=(self), camera=()",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Upload source maps for readable stack traces
  silent: !process.env.CI,

  // Org and project from Sentry
  org: "siabto-creatives",
  project: "quotd",

  // Route browser requests through a tunnel to avoid ad-blockers
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry debug logging
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
});
