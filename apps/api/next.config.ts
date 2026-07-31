import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@miolos/core", "@miolos/db"],
  poweredByHeader: false,
};

export default nextConfig;
