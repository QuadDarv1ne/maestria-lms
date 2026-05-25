import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { csrfProtection, getCsrfCookie } from "@/lib/csrf";

const PROTECTED_ROUTES = {
  "/admin": ["admin"],
  "/teacher": ["admin", "teacher"],
  "/course-editor": ["admin", "teacher"],
} as const;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const matchedRoute = Object.entries(PROTECTED_ROUTES).find(
    ([route]) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (matchedRoute) {
    const [_, allowedRoles] = matchedRoute;
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const loginUrl = new URL("/#login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    const role = (token as { role?: string }).role;
    if (!role || !allowedRoles.includes(role as any)) {
      const homeUrl = new URL("/", request.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  const response = NextResponse.next();

  // CSRF protection for state-changing requests (exclude webhook/API routes)
  const csrfExcludedPaths = ["/api/seed", "/api/webhook", "/api/auth/callback", "/api/auth/[...nextauth]"];
  const isCsrfExcluded = csrfExcludedPaths.some((path) => pathname.startsWith(path));

  if (!isCsrfExcluded) {
    const csrfResponse = csrfProtection(request);
    if (csrfResponse) return csrfResponse;
  }

  // Set CSRF cookie on responses for new sessions
  if (!request.cookies.has("csrf-token")) {
    const { serialize } = getCsrfCookie();
    response.headers.set("Set-Cookie", serialize);
  }

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "0");

  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://api.dicebear.com",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/sse).*)",
  ],
};
