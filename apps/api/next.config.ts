import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@miolos/core"],
  poweredByHeader: false,
};

export default nextConfig;
