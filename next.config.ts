import type { NextConfig } from "next";
import os from "node:os";

// Security headers are set in next.config.ts with fine-grained control
// (different rules for API routes, static assets, etc.)
// src/proxy.ts (Next.js 16 middleware) also applies security headers,
// locale detection and maintenance mode on every request.
//
// NOTE: Amvera's reverse proxy may override some headers (especially Content-Security-Policy).

/**
 * Next.js blocks every cross-origin request to dev-only assets (client chunks,
 * HMR, fonts) unless the origin is explicitly allowed. Opening the dev server
 * from another device through the LAN IP therefore rendered the pages but never
 * hydrated them — cards were not clickable, filter selects stayed inert and
 * pagination did nothing.
 *
 * The LAN address is collected automatically so the behaviour does not break
 * when the router hands out a different DHCP lease. Extra hosts can be listed
 * in ALLOWED_DEV_ORIGINS (comma separated).
 */
function collectDevOrigins(): string[] {
  const origins = new Set<string>();

  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      if (!isPrivateIPv4(address.address)) continue;
      origins.add(address.address);
    }
  }

  for (const extra of (process.env.ALLOWED_DEV_ORIGINS ?? "").split(",")) {
    const host = extra.trim();
    if (host) origins.add(host);
  }

  return [...origins];
}

function isPrivateIPv4(address: string): boolean {
  return (
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  );
}

const nextConfig: NextConfig = {
  output: "standalone",
  // Only affects `next dev`; the production build ignores it.
  allowedDevOrigins: collectDevOrigins(),
  outputFileTracingIncludes: {
    "/": [
      "node_modules/prisma",
      "node_modules/@prisma",
      "node_modules/jiti",
      "node_modules/dotenv",
    ],
  },
  turbopack: {
    ignoreIssue: [
      {
        path: "**/next.config.ts",
        title: "Encountered unexpected file in NFT list",
      },
      // Several runtime paths are environment-driven by design (the SQLite file
      // from DATABASE_URL, application log files), so the bundler cannot bound
      // them statically and traces the project instead. On Next 16.3 this is
      // reported as a build-stopping issue, so the pattern is acknowledged here.
      {
        path: "**/*",
        title: "Dynamic filesystem access causes tracing of the whole project",
      },
    ],
  },
  reactStrictMode: true,
  // Do not advertise the framework in response headers.
  poweredByHeader: false,
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
      // The full security-header set is applied by the middleware
      // (src/proxy.ts via src/lib/security-headers.ts). The paths below are
      // excluded from the middleware matcher, so they keep a minimal fallback
      // here — values must stay in sync with src/lib/security-headers.ts.
      {
        source: "/_next/static/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
      {
        source: "/_next/image",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
      {
        source: "/_next/webpack-hmr",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
      {
        source: "/favicon.ico",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
      {
        source: "/api/notifications/sse",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
      {
        source: "/api/notifications/sse/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
      // Cache static assets aggressively
      {
        source: "/:path*.{js,css,woff2}",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, must-revalidate" },
        ],
      },
      // Cache images
      {
        source: "/:path*.{jpg,jpeg,png,gif,webp,avif,svg,ico}",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, s-maxage=86400" },
        ],
      },
      // Noindex API routes
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-API-Version", value: "3.6.0" },
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
