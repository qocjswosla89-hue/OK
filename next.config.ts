import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force rebuild - v2
  generateBuildId: async () => `build-${Date.now()}`,
};

export default nextConfig;
