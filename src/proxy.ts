import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { csrfProtection } from "@/lib/csrf";
import { env } from "@/lib/env";
import { applySecurityHeaders } from "@/lib/security-headers";

// Validate required environment variables at startup (middleware is always loaded)
env.validate();

// ─── Locale Detection ────────────────────────────────────────────────────────

const VALID_LOCALES = ["ru", "en", "zh"] as const;
type Locale = (typeof VALID_LOCALES)[number];
const DEFAULT_LOCALE: Locale = "ru";
const LOCALE_COOKIE = "maestria-locale";
const MAINTENANCE_COOKIE = "maestria-maintenance-bypass";

// Match only actual file extensions — NOT paths with dots in parameters
// e.g. /blog/2024-01-01 should NOT match, but /file.js should
const PUBLIC_FILE_PATTERN = /\.(js|jsx|ts|tsx|css|scss|less|mjs|cjs|png|jpg|jpeg|gif|svg|ico|webp|avif|woff|woff2|eot|ttf|otf|map|json|xml|txt|md|yaml|yml)$/i;
const API_ROUTE_PATTERN = /^\/api\//;
const STATIC_ASSET_PATTERN = /\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico|webp|avif|json|xml|txt)$/i;

function getPreferredLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value as Locale | undefined;
  if (cookieLocale && VALID_LOCALES.includes(cookieLocale)) {
    return cookieLocale;
  }

  const acceptLanguage = request.headers.get("Accept-Language");
  if (acceptLanguage) {
    const parsed = acceptLanguage.split(",")[0]?.split("-")[0]?.toLowerCase();
    if (parsed && VALID_LOCALES.includes(parsed as Locale)) {
      return parsed as Locale;
    }
  }

  return DEFAULT_LOCALE;
}

function isMaintenanceMode(): boolean {
  return process.env.MAINTENANCE_MODE === "true";
}

function hasMaintenanceBypass(request: NextRequest): boolean {
  const bypass = request.cookies.get(MAINTENANCE_COOKIE)?.value;
  return bypass === process.env.MAINTENANCE_BYPASS_SECRET;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Role = "admin" | "teacher";
const PROTECTED_ROUTES = {
  "/admin": ["admin" as const],
  "/teacher": ["admin" as const, "teacher" as const],
  "/course-editor": ["admin" as const, "teacher" as const],
} as const;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    // Still apply security headers to static files
    const response = NextResponse.next();
    applySecurityHeaders(response, pathname);
    return response;
  }

  // ── Maintenance Mode ───────────────────────────────────────────────────
  if (isMaintenanceMode() && !hasMaintenanceBypass(request)) {
    if (!API_ROUTE_PATTERN.test(pathname)) {
      const url = new URL("/maintenance", request.url);
      const response = NextResponse.rewrite(url);
      applySecurityHeaders(response, pathname);
      return response;
    }
  }

  // ── Locale Handling ────────────────────────────────────────────────────
  // The app uses cookie-based locales (no /ru-* routes exist).
  if (!API_ROUTE_PATTERN.test(pathname)) {
    const preferredLocale = getPreferredLocale(request);

    // Legacy locale-prefixed URLs (/ru, /en, /zh) — redirect to the
    // unprefixed path and pin the locale from the URL in the cookie.
    const urlLocale = VALID_LOCALES.find(
      (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
    );
    if (urlLocale) {
      const strippedPath = pathname.slice(urlLocale.length + 1) || "/";
      const url = new URL(strippedPath, request.url);
      url.search = request.nextUrl.search;

      const response = NextResponse.redirect(url, 308);
      response.cookies.set(LOCALE_COOKIE, urlLocale, {
        path: "/",
        sameSite: "lax",
        maxAge: 31536000,
        secure: process.env.NODE_ENV === "production",
      });
      applySecurityHeaders(response, pathname);
      return response;
    }

    // Set locale cookie if not already set (from Accept-Language)
    const existingLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    if (!existingLocale || !VALID_LOCALES.includes(existingLocale as Locale)) {
      const response = NextResponse.next();
      response.cookies.set(LOCALE_COOKIE, preferredLocale, {
        path: "/",
        sameSite: "lax",
        maxAge: 31536000,
        secure: process.env.NODE_ENV === "production",
      });
      applySecurityHeaders(response, pathname);
      return response;
    }
  }

  // ── Auth / Role Checks ─────────────────────────────────────────────────
  const matchedRoute = Object.entries(PROTECTED_ROUTES).find(
    ([route]) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (matchedRoute) {
    const [_, allowedRoles] = matchedRoute as [string, readonly Role[]];
    const token = await getToken({
      req: request,
      secret: env.nextAuthSecret,
    });

    if (!token) {
      const loginUrl = new URL("/#login", request.url);
      const response = NextResponse.redirect(loginUrl);
      applySecurityHeaders(response, pathname);
      return response;
    }

    const role = "role" in token ? (token as { role?: Role }).role : undefined;
    if (!role || !allowedRoles.includes(role)) {
      const homeUrl = new URL("/", request.url);
      const response = NextResponse.redirect(homeUrl);
      applySecurityHeaders(response, pathname);
      return response;
    }
  }

  // ── CSRF Protection ────────────────────────────────────────────────────
  const response = NextResponse.next();

  const csrfExcludedPaths = [
    "/api/payments/webhook",
    "/api/seed",
    "/api/auth/callback",
    "/api/auth/session",
    "/api/auth/csrf",
    "/api/auth/signout",
  ];
  const isCsrfExcluded = csrfExcludedPaths.some((path) => pathname === path || pathname.startsWith(path + "/"));

  const isSafeMethod = ["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (!isCsrfExcluded && !isSafeMethod) {
    const csrfResponse = csrfProtection(request);
    if (csrfResponse) {
      applySecurityHeaders(csrfResponse, pathname);
      return csrfResponse;
    }
  }

  applySecurityHeaders(response, pathname);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|api/notifications/sse).*)",
  ],
};
