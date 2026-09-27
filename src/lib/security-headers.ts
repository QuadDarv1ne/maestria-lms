import type { NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * Single source of truth for the security headers applied to every route
 * matched by the middleware (src/proxy.ts).
 *
 * next.config.ts keeps only a minimal fallback for the paths excluded from the
 * middleware matcher — keep both files in sync when changing values here.
 */
export const SECURITY_HEADER_VALUES = {
  frameOptions: "SAMEORIGIN",
  contentTypeOptions: "nosniff",
  referrerPolicy: "no-referrer-when-downgrade",
  permissionsPolicy:
    "camera=(), microphone=(self), geolocation=(self), accelerometer=(), gyroscope=()",
  crossOriginOpenerPolicy: "same-origin-allow-popups",
  crossOriginResourcePolicy: "cross-origin",
  strictTransportSecurity: "max-age=31536000; includeSubDomains; preload",
} as const;

/** Directives that must always be present in the emitted CSP. */
export const CSP_REQUIRED_DIRECTIVES = [
  "default-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
] as const;

// Next.js generates new inline script hashes on every build and the middleware
// runs before Next.js can attach nonces, so 'unsafe-inline'/'unsafe-eval' are
// required for a self-hosted Next.js deployment.
const CSP_SCRIPT_SRC = "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:";

const FULLY_PUBLIC_API_EXACT = ["/api/auth/csrf", "/api/auth/providers"];

// Private and user-specific areas. robots.txt asks crawlers not to fetch them,
// but a URL that is already indexed is only removed with a header — hence both.
export const PRIVATE_PATH_PREFIXES = [
  "/admin",
  "/teacher",
  "/course-editor",
  "/profile",
  "/notifications",
  "/achievements",
  "/status",
  "/reset-password",
  "/payment",
  "/lesson",
];

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function safeOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function isFullyPublicApi(pathname: string): boolean {
  return (
    pathname.startsWith("/api/health") ||
    FULLY_PUBLIC_API_EXACT.includes(pathname) ||
    pathname.startsWith("/api/auth/callback")
  );
}

export function buildContentSecurityPolicy(): string {
  const connectSources = ["'self'", "https:", "http://localhost:*", "wss:"];

  const cdnOrigin = safeOrigin(env.cdnUrl);
  const s3Origin = safeOrigin(env.s3Endpoint);
  if (cdnOrigin) connectSources.push(cdnOrigin);
  if (s3Origin) connectSources.push(s3Origin);

  return [
    "default-src 'self'",
    CSP_SCRIPT_SRC,
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    `connect-src ${connectSources.join(" ")}`,
    "media-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'self' https://www.youtube.com https://player.vimeo.com https://ok.ru",
    "frame-ancestors 'self' https://www.youtube.com",
  ].join("; ");
}

/**
 * Builds the header map for a given pathname. Pure function — the unit test
 * asserts against it without needing a real NextResponse.
 */
export function buildSecurityHeaders(pathname: string): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Frame-Options": SECURITY_HEADER_VALUES.frameOptions,
    "X-Content-Type-Options": SECURITY_HEADER_VALUES.contentTypeOptions,
    "Referrer-Policy": SECURITY_HEADER_VALUES.referrerPolicy,
    "Permissions-Policy": SECURITY_HEADER_VALUES.permissionsPolicy,
    "Cross-Origin-Opener-Policy": SECURITY_HEADER_VALUES.crossOriginOpenerPolicy,
    "Cross-Origin-Resource-Policy": SECURITY_HEADER_VALUES.crossOriginResourcePolicy,
  };

  if (isPrivatePath(pathname)) {
    headers["X-Robots-Tag"] = "noindex, nofollow";
  }

  if (pathname.startsWith("/api/")) {
    headers["Access-Control-Allow-Origin"] = isFullyPublicApi(pathname) ? "*" : env.siteUrl;
    headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  if (env.isProduction) {
    headers["Strict-Transport-Security"] = SECURITY_HEADER_VALUES.strictTransportSecurity;
  }

  headers["Content-Security-Policy"] = buildContentSecurityPolicy();

  return headers;
}

export function applySecurityHeaders(response: NextResponse, pathname: string): void {
  for (const [key, value] of Object.entries(buildSecurityHeaders(pathname))) {
    response.headers.set(key, value);
  }
}
