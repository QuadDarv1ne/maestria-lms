import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { csrfProtection } from "@/lib/csrf";
import { env } from "@/lib/env";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  const response = NextResponse.next();

  const csrfExcludedPaths = [
    "/api/payments/webhook",
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

  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      env.isProduction
        ? `script-src 'self' 'sha256-9OKft+AY+D0tuNek9651LK+/tdhr5+FWBPAqsL039wg='`
        : `script-src 'self' 'unsafe-eval' 'sha256-9OKft+AY+D0tuNek9651LK+/tdhr5+FWBPAqsL039wg='`,
      "style-src 'self' 'unsafe-inline' https:",
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
