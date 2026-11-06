import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { csrfProtection } from "@/lib/csrf";
import { env } from "@/lib/env";
import { applySecurityHeaders } from "@/lib/security-headers";
import { evaluateAdminIpAccess, isAdminPath, resolveClientIp } from "@/lib/admin-ip-allowlist";
import { log } from "@/lib/logger";

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
  // Fail closed: if the bypass secret is not configured, nobody gets a bypass.
  // Otherwise an unset secret (undefined) would equal a missing cookie
  // (undefined) and silently disable maintenance mode for every visitor.
  const secret = process.env.MAINTENANCE_BYPASS_SECRET;
  if (!secret) return false;
  const bypass = request.cookies.get(MAINTENANCE_COOKIE)?.value;
  return !!bypass && bypass === secret;
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

  // ── Admin IP allowlist ─────────────────────────────────────────────────
  // Optional second factor for the admin area (ADMIN_IP_ALLOWLIST). Deliberately
  // placed before the locale bootstrap and the auth check: the locale branch
  // returns early for a cookie-less request, and a stolen session cookie used
  // from an unlisted network should never reach token verification.
  if (isAdminPath(pathname)) {
    const clientIp = resolveClientIp(request.headers);
    const decision = evaluateAdminIpAccess(clientIp, env.adminIpAllowlist, env.adminIpAllowlistMode);

    if (!decision.allowed) {
      log.warn("Admin access blocked by IP allowlist", {
        pathname,
        clientIp: clientIp ?? "unknown",
        reason: decision.reason,
      });

      if (API_ROUTE_PATTERN.test(pathname)) {
        const response = NextResponse.json(
          {
            error:
              decision.reason === "invalid-config"
                ? "Admin IP allowlist is misconfigured"
                : "Forbidden",
            code: "FORBIDDEN",
          },
          { status: 403 },
        );
        applySecurityHeaders(response, pathname);
        return response;
      }

      const response = NextResponse.rewrite(new URL("/forbidden", request.url), { status: 403 });
      applySecurityHeaders(response, pathname);
      return response;
    }

    // Warn mode is the dry run that proves the proxy forwards the address. Without
    // this line a deployment would never learn that enforce mode would lock it out.
    if (decision.reason === "would-block") {
      log.warn("Admin access would be blocked by IP allowlist (warn mode)", {
        pathname,
        clientIp: clientIp ?? "unknown",
        wouldBlock: decision.wouldBlock,
        hint: "switch ADMIN_IP_ALLOWLIST_MODE to enforce once the client IP is correct here",
      });
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
