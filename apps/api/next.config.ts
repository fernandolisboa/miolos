import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@miolos/core", "@miolos/db", "@miolos/games"],
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
