/**
 * API Request Logging Middleware
 *
 * Provides structured request/response logging for all API routes.
 * Logs method, path, status code, duration, and user context.
 * Attaches X-Request-Id and X-Response-Time headers to all API responses.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { log } from "@/lib/logger";
import crypto from "crypto";

export interface ApiLogContext {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId?: string;
  userRole?: string;
  requestId: string;
  queryParams?: Record<string, string>;
}

/**
 * Generate a unique request ID for tracing.
 */
export function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Extract safe query params (excludes sensitive values like tokens, passwords).
 */
function extractSafeQueryParams(url: string): Record<string, string> {
  try {
    const { searchParams } = new URL(url);
    const SENSITIVE_KEYS = new Set(["token", "password", "secret", "key", "code", "twoFactorCode"]);
    const params: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      params[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : value;
    }
    return params;
  } catch {
    return {};
  }
}

/**
 * Log an API request with timing and context.
 * Call this at the end of each API route handler.
 */
export function logApiRequest(context: ApiLogContext): void {
  const level = context.statusCode >= 500 ? "error" : context.statusCode >= 400 ? "warn" : "info";

  log[level](`${context.method} ${context.path} → ${context.statusCode} (${context.durationMs}ms)`, {
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    statusCode: context.statusCode,
    durationMs: context.durationMs,
    userId: context.userId,
    userRole: context.userRole,
    queryParams: Object.keys(context.queryParams ?? {}).length > 0 ? context.queryParams : undefined,
  });
}

/**
 * Wrap an API route handler with request logging.
 * Automatically logs the request and attaches X-Request-Id / X-Response-Time headers.
 *
 * @example
 * ```ts
 * export const GET = withApiLogging(async (request, context) => {
 *   // ... handler logic
 *   return NextResponse.json({ ok: true });
 * });
 * ```
 */
export function withApiLogging<T>(
  handler: (
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
  ) => Promise<NextResponse<T>>,
) {
  return async (
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse<T>> => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const method = request.method;
    const path = request.nextUrl.pathname;
    const queryParams = extractSafeQueryParams(request.url);

    try {
      const response = await handler(request, context);

      const durationMs = Date.now() - startTime;
      const statusCode = response.status;

      // Extract user info from response headers if set by auth middleware
      const userId = response.headers.get("X-User-Id") ?? undefined;
      const userRole = response.headers.get("X-User-Role") ?? undefined;

      logApiRequest({
        method,
        path,
        statusCode,
        durationMs,
        userId,
        userRole,
        requestId,
        queryParams,
      });

      // Attach tracing headers
      const headers = new Headers(response.headers);
      headers.set("X-Request-Id", requestId);
      headers.set("X-Response-Time", `${durationMs}ms`);

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;
      const statusCode = error instanceof Error && "status" in error ? (error as { status: number }).status : 500;

      log.error(`API Error: ${method} ${path} → ${statusCode} (${durationMs}ms)`, {
        requestId,
        method,
        path,
        statusCode,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return NextResponse.json(
        { error: "Внутренняя ошибка сервера" },
        {
          status: 500,
          headers: {
            "X-Request-Id": requestId,
            "X-Response-Time": `${durationMs}ms`,
          },
        },
      ) as NextResponse<T>;
    }
  };
}