import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { log } from "@/lib/logger";

// Skip logging for static assets and health checks
const SKIP_PATHS = [
  "/_next/static",
  "/_next/image",
  "/favicon.ico",
  "/api/health",
  "/maestro7it-logo.png",
];

function shouldSkip(pathname: string): boolean {
  return SKIP_PATHS.some((skip) => pathname.startsWith(skip));
}

/**
 * Middleware for request/response logging.
 * Logs method, path, status, duration, and response size.
 */
export function requestLoggerMiddleware(request: NextRequest) {
  const start = Date.now();
  const { pathname, method } = request.nextUrl;

  if (shouldSkip(pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // Log after response is processed
  const end = Date.now();
  const duration = end - start;

  log.info("Request", {
    method,
    path: pathname,
    duration: `${duration}ms`,
    userAgent: request.headers.get("user-agent")?.substring(0, 50),
  });

  return response;
}
