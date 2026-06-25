import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@/shared/ui", "@/shared/lib", "@/features"],
  },
};

export default nextConfig;
