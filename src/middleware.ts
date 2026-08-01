/**
 * Global Middleware for Maestria LMS
 *
 * Handles at the edge:
 * - Locale detection and redirection
 * - Maintenance mode check
 * - Bot detection (logging only)
 *
 * NOTE: Security headers are set in next.config.ts (async headers)
 * because Edge middleware does NOT run in standalone mode on Amvera.
 *
 * This middleware only handles logic that MUST run at the edge:
 * locale redirects and maintenance mode.
 *
 * IMPORTANT: Edge middleware runs in a different runtime (Edge Runtime),
 * so we cannot use @/lib/logger here. We use process.env directly
 * and avoid importing any Node.js-specific modules.
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

      return response;
    }
  }

  // ── Handle Request ─────────────────────────────────────────────────────
  const response = NextResponse.next();

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

  // ── Development Logging ────────────────────────────────────────────────
  if (process.env.NODE_ENV === "development") {
    const duration = Date.now() - startTime;
    const userAgent = request.headers.get("user-agent") ?? "";
    const isBotRequest = isBot(userAgent);
    // eslint-disable-next-line no-console
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