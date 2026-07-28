import type { NextConfig } from "next";

// Security headers are set in proxy.ts middleware with fine-grained control
// (different rules for API routes, static assets, etc.)
// Do NOT duplicate them here — the middleware always runs after these config headers.

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "**.trbcdn.net" },
      { protocol: "https", hostname: "*.freeimage.host" },
      { protocol: "https", hostname: "iili.io" },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async headers() {
    return [
      {
        source: "/:path*.{js,css,woff2}",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, must-revalidate" },
        ],
      },
    ];
  },
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },
};

export default nextConfig;
