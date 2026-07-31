import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@miolos/ui", "@miolos/core"],
  poweredByHeader: false,
};

export default nextConfig;
