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
  // Bundle analyzer в dev
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            default: false,
            vendors: false,
            // Полифины
            polyfills: {
              test: /[\\/]node_modules[\\/].*polyfill.*/i,
              name: "polyfills",
              priority: 20,
            },
            // React и зависимости
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/i,
              name: "react",
              priority: 15,
            },
            // UI компоненты
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|shadcn-ui|tailwind-merge|clsx)[\\/]/i,
              name: "ui",
              priority: 10,
            },
            // Общие чанки
            common: {
              minChunks: 2,
              name: "common",
              priority: 5,
            },
          },
        },
      };
    }
    return config;
  },
  // Трекинг размера bundle
  productionBrowserSourceMaps: false,
  // Удаление строк логов в продакшене
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

export default nextConfig;
