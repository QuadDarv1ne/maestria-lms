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

    const role = (token as { role?: Role }).role;
    if (!role || !allowedRoles.includes(role)) {
      const homeUrl = new URL("/", request.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  const response = NextResponse.next();

  // CSRF protection for state-changing requests.
  // Only exclude external webhook endpoints (payment providers, etc.) and NextAuth auth callbacks.
  // All internal API routes use cookie-based JWT sessions and MUST be CSRF-protected.
  const csrfExcludedPaths = [
    "/api/payments/webhook",       // External payment provider webhooks (HMAC verified)
    "/api/auth/callback",          // NextAuth OAuth callbacks
    "/api/auth/session",           // NextAuth session endpoint (CSRF handled internally)
    "/api/auth/csrf",              // NextAuth CSRF token endpoint
    "/api/auth/signout",           // NextAuth signout endpoint (CSRF handled internally)
  ];
  const isCsrfExcluded = csrfExcludedPaths.some((path) => pathname === path || pathname.startsWith(path + "/"));

  if (!isCsrfExcluded) {
    const csrfResponse = csrfProtection(request);
    if (csrfResponse) return csrfResponse;
  }

  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");

  response.headers.set("Referrer-Policy", "no-referrer-when-downgrade");

  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(self), accelerometer=(), gyroscope=()",
  );

  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set("Cross-Origin-Resource-Policy", "cross-origin");

  // CORS для health check и API
  if (pathname.startsWith("/api/health") || pathname.startsWith("/api/")) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  const isProduction = env.isProduction;

  if (isProduction) {
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
      `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
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

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|api/notifications/sse).*)",
  ],
};
