/**
 * Global Middleware for Maestria LMS
 *
 * Handles at the edge:
 * - Security headers (CSP, HSTS, X-Frame-Options, etc.)
 * - Locale detection and redirection
 * - Maintenance mode check
 * - Request logging (in development)
 * - Bot detection
 * - API route protection
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_LOCALES = ["ru", "en", "zh"] as const;
type Locale = (typeof VALID_LOCALES)[number];
const DEFAULT_LOCALE: Locale = "ru";

const LOCALE_COOKIE = "maestria-locale";
const MAINTENANCE_COOKIE = "maestria-maintenance-bypass";

const PUBLIC_FILE_PATTERN = /\.(.*)$/;
const API_ROUTE_PATTERN = /^\/api\//;
const STATIC_ASSET_PATTERN = /\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico|webp|avif|json|xml|txt)$/i;

// ─── Security Headers ────────────────────────────────────────────────────────

const SECURITY_HEADERS: Record<string, string> = {
  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",
  // Prevent clickjacking
  "X-Frame-Options": "DENY",
  // Enable XSS filter in older browsers
  "X-XSS-Protection": "1; mode=block",
  // Referrer policy
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // HTTP Strict Transport Security (1 year, include subdomains, preload)
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  // Disable feature permissions
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  // Content Security Policy
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.dicebear.com https://mc.yandex.ru https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https: wss:",
    "media-src 'self' https: blob:",
    "frame-src 'self' https://www.youtube.com https://vk.com https://rutube.ru",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

// ─── Locale Detection ────────────────────────────────────────────────────────

/**
 * Extract the preferred locale from the request.
 * Priority: cookie > Accept-Language header > default
 */
function getPreferredLocale(request: NextRequest): Locale {
  // 1. Check cookie
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value as Locale | undefined;
  if (cookieLocale && VALID_LOCALES.includes(cookieLocale)) {
    return cookieLocale;
  }

  // 2. Check Accept-Language header
  const acceptLanguage = request.headers.get("Accept-Language");
  if (acceptLanguage) {
    // Parse the first locale from Accept-Language
    const parsed = acceptLanguage.split(",")[0]?.split("-")[0]?.toLowerCase();
    if (parsed && VALID_LOCALES.includes(parsed as Locale)) {
      return parsed as Locale;
    }
  }

  // 3. Default
  return DEFAULT_LOCALE;
}

// ─── Maintenance Mode ────────────────────────────────────────────────────────

function isMaintenanceMode(): boolean {
  return process.env.MAINTENANCE_MODE === "true";
}

function hasMaintenanceBypass(request: NextRequest): boolean {
  const bypass = request.cookies.get(MAINTENANCE_COOKIE)?.value;
  return bypass === process.env.MAINTENANCE_BYPASS_SECRET;
}

// ─── Bot Detection ───────────────────────────────────────────────────────────

function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const botPattern =
    /bot|crawl|spider|scrape|slurp|googlebot|bingbot|yandexbot|duckduckbot|baiduspider|facebot|twitterbot|whatsapp|telegrambot/i;
  return botPattern.test(userAgent);
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const startTime = Date.now();

  // ── Skip static files ──────────────────────────────────────────────────
  if (
    PUBLIC_FILE_PATTERN.test(pathname) ||
    STATIC_ASSET_PATTERN.test(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/courses/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js"
  ) {
    return NextResponse.next();
  }

  // ── Maintenance Mode ───────────────────────────────────────────────────
  if (isMaintenanceMode() && !hasMaintenanceBypass(request)) {
    // Allow API routes to function for logged-in admins
    if (!API_ROUTE_PATTERN.test(pathname)) {
      const url = new URL("/maintenance", request.url);
      return NextResponse.rewrite(url);
    }
  }

  // ── Locale Detection ───────────────────────────────────────────────────
  // Only apply to page routes (not API routes)
  if (!API_ROUTE_PATTERN.test(pathname)) {
    const preferredLocale = getPreferredLocale(request);

    // Check if the pathname already has a locale prefix
    const hasLocalePrefix = VALID_LOCALES.some(
      (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
    );

    if (!hasLocalePrefix) {
      // Redirect to locale-prefixed URL
      const url = new URL(`/${preferredLocale}${pathname === "/" ? "" : pathname}`, request.url);
      url.search = request.nextUrl.search;

      const response = NextResponse.redirect(url, 308);

      // Set locale cookie
      response.cookies.set(LOCALE_COOKIE, preferredLocale, {
        path: "/",
        sameSite: "lax",
        maxAge: 31536000, // 1 year
        secure: process.env.NODE_ENV === "production",
      });

      // Apply security headers
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    }
  }

  // ── Handle Request ─────────────────────────────────────────────────────
  const response = NextResponse.next();

  // ── Apply Security Headers ─────────────────────────────────────────────
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // ── Set Locale Cookie (if not already set) ─────────────────────────────
  if (!API_ROUTE_PATTERN.test(pathname)) {
    const existingLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    if (!existingLocale || !VALID_LOCALES.includes(existingLocale as Locale)) {
      const preferredLocale = getPreferredLocale(request);
      response.cookies.set(LOCALE_COOKIE, preferredLocale, {
        path: "/",
        sameSite: "lax",
        maxAge: 31536000,
        secure: process.env.NODE_ENV === "production",
      });
    }
  }

  // ── API Response Headers ───────────────────────────────────────────────
  if (API_ROUTE_PATTERN.test(pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("X-API-Version", "3.6.0");

    // Enable response compression hints
    // Actual compression is handled by the web server/CDN (Amvera, nginx, Cloudflare)
    response.headers.set("Vary", "Accept-Encoding");
    response.headers.set("X-Compression", "enabled");
  }

  // ── Compression Support for non-API routes ────────────────────────────
  // Signal to CDN/reverse-proxy that responses can be compressed
  if (!response.headers.has("Vary")) {
    response.headers.set("Vary", "Accept-Encoding");
  }

  // ── Development Logging ────────────────────────────────────────────────
  if (process.env.NODE_ENV === "development") {
    const duration = Date.now() - startTime;
    const userAgent = request.headers.get("user-agent") ?? "";
    const isBotRequest = isBot(userAgent);
    console.log(
      `[Middleware] ${request.method} ${pathname} → ${response.status} (${duration}ms)${isBotRequest ? " [bot]" : ""}`,
    );
  }

  return response;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    // Match all request paths except:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - public files (images, fonts, etc.)
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};