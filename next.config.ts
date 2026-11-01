import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["192.168.96.94", "localhost"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
