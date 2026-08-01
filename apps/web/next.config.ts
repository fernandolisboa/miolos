import type { NextConfig } from "next";

// Keep in sync with the twin copy in apps/api/next.config.ts — ADR-0002 forbids a shared home for this.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source, so Next compiles them here.
  // `@miolos/db` is server-only in practice (src/db.ts carries the
  // `server-only` guard) and `@miolos/games` ships the Binairo solver the
  // hint and the local validation need on the client (ADR-0027).
  transpilePackages: [
    "@miolos/ui",
    "@miolos/core",
    "@miolos/db",
    "@miolos/games",
  ],
  poweredByHeader: false,
  headers: () =>
    Promise.resolve([
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]),
};

export default nextConfig;
