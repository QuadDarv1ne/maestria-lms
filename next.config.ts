import type { NextConfig } from "next";

// Security headers are set in next.config.ts with fine-grained control
// (different rules for API routes, static assets, etc.)
// src/proxy.ts (Next.js 16 middleware) also applies security headers,
// locale detection and maintenance mode on every request.
//
// NOTE: Amvera's reverse proxy may override some headers (especially Content-Security-Policy).

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    ignoreIssue: [
      {
        path: "**/next.config.ts",
        title: "Encountered unexpected file in NFT list",
      },
    ],
  },
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
      // Security headers for ALL routes (including HTML pages)
      {
        source: "/:path*",
        headers: [
          // Prevent MIME type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Enable XSS filter in older browsers
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Referrer policy
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // HTTP Strict Transport Security (1 year, include subdomains, preload)
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          // Disable feature permissions
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          // Content Security Policy — allows Next.js inline scripts to work
          // NOTE: Amvera's nginx may override this header. If the site is blank,
          // check the CSP in browser devtools. If it shows a different CSP,
          // Amvera is overriding it and you need to configure CSP in Amvera's dashboard.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
              "style-src 'self' 'unsafe-inline' https:",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https:",
              "connect-src 'self' https: http://localhost:* wss: http://localhost:*:",
              "media-src 'self' https:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-src 'self' https://www.youtube.com https://player.vimeo.com https://ok.ru",
              "frame-ancestors 'self' https://www.youtube.com",
            ].join("; "),
          },
        ],
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
