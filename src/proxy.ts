import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { csrfProtection } from "@/lib/csrf";
import { env } from "@/lib/env";

// ─── Locale Detection ────────────────────────────────────────────────────────

const VALID_LOCALES = ["ru", "en", "zh"] as const;
type Locale = (typeof VALID_LOCALES)[number];
const DEFAULT_LOCALE: Locale = "ru";
const LOCALE_COOKIE = "maestria-locale";
const MAINTENANCE_COOKIE = "maestria-maintenance-bypass";

const PUBLIC_FILE_PATTERN = /\.(.*)$/;
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

function safeOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).origin; } catch { return null; }
}

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
      return response;
    }
  }

  // ── Locale Detection ───────────────────────────────────────────────────
  if (!API_ROUTE_PATTERN.test(pathname)) {
    const preferredLocale = getPreferredLocale(request);
    const hasLocalePrefix = VALID_LOCALES.some(
      (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
    );

    if (!hasLocalePrefix) {
      const url = new URL(`/${preferredLocale}${pathname === "/" ? "" : pathname}`, request.url);
      url.search = request.nextUrl.search;

      const response = NextResponse.redirect(url, 308);
      response.cookies.set(LOCALE_COOKIE, preferredLocale, {
        path: "/",
        sameSite: "lax",
        maxAge: 31536000,
        secure: process.env.NODE_ENV === "production",
      });
      return response;
    }

    // Set locale cookie if not already set
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
      return NextResponse.redirect(loginUrl);
    }

    const role = "role" in token ? (token as { role?: Role }).role : undefined;
    if (!role || !allowedRoles.includes(role)) {
      const homeUrl = new URL("/", request.url);
      return NextResponse.redirect(homeUrl);
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

function applySecurityHeaders(response: NextResponse, pathname: string): void {
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");

  response.headers.set("Referrer-Policy", "no-referrer-when-downgrade");

  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(self), accelerometer=(), gyroscope=()",
  );

  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set("Cross-Origin-Resource-Policy", "cross-origin");

  if (pathname.startsWith("/api/")) {
    const isFullyPublic = pathname.startsWith("/api/health") || pathname === "/api/auth/csrf"
      || pathname === "/api/auth/providers" || pathname.startsWith("/api/auth/callback");
    response.headers.set(
      "Access-Control-Allow-Origin",
      isFullyPublic ? "*" : env.siteUrl,
    );
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  if (env.isProduction) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  const cdnOrigin = safeOrigin(env.cdnUrl);
  const s3Origin = safeOrigin(env.s3Endpoint);

  const imgSources = [
    "'self'",
    "data:",
    "blob:",
    "https://api.dicebear.com",
    "https://freeimage.host",
    "https://iili.io",
    "https://*.freeimage.host",
    "https://*.trbcdn.net",
    "https://img.youtube.com",
    "https://i.ytimg.com",
    "https://placehold.co",
    "https://via.placeholder.com",
  ];
  if (cdnOrigin) imgSources.push(cdnOrigin);

  const connectSources = [
    "'self'",
    "ws:",
    "wss:",
    "https://*.pusher.com",
    "https://*.socket.io",
    "https://api.resend.com",
  ];
  if (cdnOrigin) connectSources.push(cdnOrigin);
  if (s3Origin) connectSources.push(s3Origin);

  // Next.js generates new inline script hashes on every build.
  // Using 'unsafe-inline' for scripts is required because we cannot
  // predict the hashes at build time. In production, Next.js uses
  // nonces for its inline scripts, but the middleware runs before
  // Next.js can set them. 'unsafe-inline' is the pragmatic choice
  // for self-hosted Next.js deployments.
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      `img-src ${imgSources.join(" ")}`,
      "font-src 'self' https: data:",
      `connect-src ${connectSources.join(" ")}`,
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|api/notifications/sse).*)",
  ],
};
