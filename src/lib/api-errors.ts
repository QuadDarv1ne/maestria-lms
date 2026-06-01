import { NextResponse } from "next/server";
import { log } from "./logger";

/**
 * Standardized API error response.
 * Logs the error with context and returns a JSON response.
 */
function apiError(
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
  if (typeof error !== "object" || error === null) return false;
  if (!("issues" in error)) return false;
  const issues = (error as { issues: unknown }).issues;
  if (!Array.isArray(issues) || issues.length === 0) return false;
  const first = issues[0];
  return typeof first === "object" && first !== null && "message" in first;
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
      return apiError(mapping.message, mapping.status, {
        ...context,
        prismaCode: error.code,
        prismaMessage: error.message,
      });
    }
    // Unknown Prisma code
    return apiError("Внутренняя ошибка сервера", 500, {
      ...context,
      prismaCode: error.code,
      prismaMessage: error.message,
    });
  }

  // Zod validation errors
  if (isZodError(error)) {
    const firstIssue = error.issues[0];
    return apiError(firstIssue.message, 400, { ...context, zodIssues: error.issues });
  }

  // Generic errors
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : "UnknownError";
  return apiError("Внутренняя ошибка сервера", 500, {
    ...context,
    name: errorName,
    message: errorMessage,
  });
}
