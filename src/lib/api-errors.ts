import { NextResponse } from "next/server";
import { log } from "./logger";

/**
 * Standardized API error response.
 * Logs the error with context and returns a JSON response.
 */
export function apiError(
  message: string,
  status: number,
  context?: Record<string, unknown>,
): NextResponse {
  if (status >= 500) {
    log.error(message, context);
  } else if (status >= 400) {
    log.warn(message, context);
  }
  return NextResponse.json({ error: message }, { status });
}

/**
 * Catch-all error handler for API routes.
 * Logs the error and returns a generic 500 response.
 */
export function handleApiError(error: unknown, context?: Record<string, unknown>): NextResponse {
  log.error("Unhandled API error", { ...context, error });
  return NextResponse.json(
    { error: "Внутренняя ошибка сервера" },
    { status: 500 }
  );
}
