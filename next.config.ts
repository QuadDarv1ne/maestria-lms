import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  turbopack: {},
  // Оптимизация изображений
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
      {
        protocol: "https",
        hostname: "iili.io",
      },
      {
        protocol: "https",
        hostname: "*.freeimage.host",
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Compression
  compress: true,
  // Headers для кэширования
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*.{js,css,woff2}",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, must-revalidate",
          },
        ],
      },
    ];
  },
  productionBrowserSourceMaps: false,
  // Удаление строк логов в продакшене
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

export default nextConfig;
