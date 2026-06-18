import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: async () => `build-${Date.now()}`,
  experimental: {
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;
