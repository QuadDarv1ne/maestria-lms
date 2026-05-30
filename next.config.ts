import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "**.trbcdn.net",
      },
      {
        protocol: "https",
        hostname: "freeimage.host",
      },
    ],
  },
};

export default nextConfig;
