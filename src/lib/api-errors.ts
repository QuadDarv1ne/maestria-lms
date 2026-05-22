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
 * Map of known Prisma error codes to user-friendly messages and HTTP status codes.
 */
const PRISMA_ERROR_MAP: Record<string, { status: number; message: string }> = {
  P2002: { status: 409, message: "Такая запись уже существует" },
  P2003: { status: 400, message: "Недопустимая операция: связанные данные не найдены" },
  P2025: { status: 404, message: "Запись не найдена" },
  P2014: { status: 400, message: "Операция нарушает связь между данными" },
};

/**
 * Check if an error object looks like a Prisma known request error.
 * Uses duck-typing to avoid importing Prisma runtime types.
 */
function isPrismaError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    ((error as { code: string }).code.startsWith("P"))
  );
}

/**
 * Check if an error object looks like a Zod validation error.
 */
function isZodError(error: unknown): error is { issues: Array<{ message: string }> } {
  return (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown }).issues) &&
    (error as { issues: Array<unknown> }).issues.length > 0 &&
    typeof (error as { issues: Array<unknown> }).issues[0] === "object" &&
    (error as { issues: Array<unknown> }).issues[0] !== null &&
    "message" in (error as { issues: Array<unknown> }).issues[0]
  );
}

/**
 * Catch-all error handler for API routes.
 * Detects Prisma and Zod errors and returns appropriate status codes.
 */
export function handleApiError(error: unknown, context?: Record<string, unknown>): NextResponse {
  // Prisma known errors
  if (isPrismaError(error)) {
    const mapping = PRISMA_ERROR_MAP[error.code];
    if (mapping) {
      log.warn(`Prisma error ${error.code}: ${error.message}`, { ...context, code: error.code });
      return NextResponse.json({ error: mapping.message }, { status: mapping.status });
    }
    // Unknown Prisma code
    log.error("Unknown Prisma error", { ...context, code: error.code, message: error.message });
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 },
    );
  }

  // Zod validation errors
  if (isZodError(error)) {
    const firstIssue = error.issues[0];
    log.warn("Zod validation error", { ...context, issues: error.issues });
    return NextResponse.json({ error: firstIssue.message }, { status: 400 });
  }

  // Generic errors
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : "UnknownError";
  log.error("Unhandled API error", { ...context, name: errorName, message: errorMessage });
  return NextResponse.json(
    { error: "Внутренняя ошибка сервера" },
    { status: 500 },
  );
}
