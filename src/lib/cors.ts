/**
 * CORS Middleware for API Routes
 *
 * Provides configurable CORS headers for API endpoints.
 * Supports whitelist-based origin validation, preflight handling,
 * and per-route configuration.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

export interface CorsOptions {
  /** Allowed origins. Default: [siteUrl] */
  allowedOrigins?: string[];
  /** Allowed HTTP methods. Default: GET, POST, PUT, PATCH, DELETE, OPTIONS */
  allowedMethods?: string[];
  /** Allowed headers. Default: Content-Type, Authorization, X-Request-Id */
  allowedHeaders?: string[];
  /** Whether to expose headers to client JS. Default: true */
  exposeHeaders?: boolean;
  /** Whether to allow credentials (cookies, auth headers). Default: true */
  allowCredentials?: boolean;
  /** Max age for preflight cache in seconds. Default: 86400 (24h) */
  maxAge?: number;
}

const DEFAULT_OPTIONS: Required<CorsOptions> = {
  allowedOrigins: [],
  allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-CSRF-Token"],
  exposeHeaders: true,
  allowCredentials: true,
  maxAge: 86400,
};

/**
 * Get the list of allowed origins.
 * Includes the site URL and any additional origins from env.
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  const siteUrl = env.siteUrl;
  if (siteUrl) origins.push(siteUrl);

  // Allow localhost in development
  if (env.isDevelopment) {
    origins.push("http://localhost:3000");
    origins.push("http://localhost:3001");
    origins.push("http://127.0.0.1:3000");
  }

  return origins;
}

/**
 * Check if an origin is allowed.
 * Returns the origin if allowed, or null if not.
 */
function isOriginAllowed(origin: string | null, allowedOrigins: string[]): string | null {
  if (!origin) return null;
  if (allowedOrigins.includes("*")) return origin;
  if (allowedOrigins.includes(origin)) return origin;
  return null;
}

/**
 * Apply CORS headers to a response.
 */
export function applyCorsHeaders(
  response: NextResponse,
  origin: string | null,
  options: CorsOptions = {},
): NextResponse {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allowedOrigins = opts.allowedOrigins.length > 0 ? opts.allowedOrigins : getAllowedOrigins();
  const allowedOrigin = isOriginAllowed(origin, allowedOrigins);

  if (allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }

  if (opts.allowCredentials) {
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  response.headers.set("Access-Control-Allow-Methods", opts.allowedMethods.join(", "));
  response.headers.set("Access-Control-Allow-Headers", opts.allowedHeaders.join(", "));

  if (opts.exposeHeaders) {
    response.headers.set(
      "Access-Control-Expose-Headers",
      "X-Request-Id, X-Response-Time, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
    );
  }

  response.headers.set("Access-Control-Max-Age", String(opts.maxAge));

  return response;
}

/**
 * Handle CORS preflight (OPTIONS) request.
 * Returns a 204 response with CORS headers, or null if origin is not allowed.
 */
export function handleCorsPreflight(
  request: NextRequest,
  options: CorsOptions = {},
): NextResponse | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allowedOrigins = opts.allowedOrigins.length > 0 ? opts.allowedOrigins : getAllowedOrigins();
  const origin = request.headers.get("origin");
  const allowedOrigin = isOriginAllowed(origin, allowedOrigins);

  if (!allowedOrigin) {
    // Origin not allowed — return null so the route can handle it
    return null;
  }

  const response = new NextResponse(null, { status: 204 });
  return applyCorsHeaders(response, origin, options);
}

/**
 * Wrap an API route handler with CORS protection.
 * Automatically handles preflight and adds CORS headers to all responses.
 *
 * @example
 * ```ts
 * export const GET = withCors(async (request, context) => {
 *   return NextResponse.json({ ok: true });
 * });
 * ```
 */
export function withCors<T>(
  handler: (
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
  ) => Promise<NextResponse<T>>,
  options: CorsOptions = {},
) {
  return async (
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse<T>> => {
    // Handle preflight
    if (request.method === "OPTIONS") {
      const preflightResponse = handleCorsPreflight(request, options);
      if (preflightResponse) {
        return preflightResponse as NextResponse<T>;
      }
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 }) as NextResponse<T>;
    }

    // Handle actual request
    const origin = request.headers.get("origin");
    const response = await handler(request, context);
    return applyCorsHeaders(response, origin, options) as NextResponse<T>;
  };
}