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

/**
 * Auth guard helper. Returns a 401 response if the session is invalid.
 * Usage: const authResult = requireAuth(session); if (authResult) return authResult;
 */
export function requireAuth(session: { user?: unknown } | null): NextResponse | null {
  if (!session?.user) {
    return NextResponse.json(
      { error: "Необходимо авторизоваться" },
      { status: 401 }
    );
  }
  return null;
}

/**
 * Role-based access guard. Returns a 403 response if the user lacks the required role.
 * Usage: const roleResult = requireRole(session, "admin"); if (roleResult) return roleResult;
 */
export function requireRole(
  session: { user?: { role?: string } } | null,
  role: string,
): NextResponse | null {
  if (!session?.user || session.user.role !== role) {
    log.warn("Unauthorized role access attempt", {
      userId: session?.user?.role ? "(authenticated)" : "(unauthenticated)",
      requiredRole: role,
      actualRole: session?.user?.role,
    });
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }
  return null;
}
