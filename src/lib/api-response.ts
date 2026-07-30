import { NextResponse } from "next/server";

/**
 * Creates a promise that rejects after the specified timeout.
 * Use to wrap API route handlers for timeout protection.
 *
 * @example
 * ```ts
 * export async function GET(request: NextRequest) {
 *   return withTimeout(async () => {
 *     // ... handler logic
 *     return NextResponse.json({ data });
 *   }, 10000);
 * }
 * ```
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 10000,
  timeoutMessage: string = "Request timed out"
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
    // Allow the timeout to be cancelled if the fn completes
    if (typeof timeoutId === "object" && typeof timeoutId.unref === "function") {
      timeoutId.unref();
    }
  });

  return Promise.race([fn(), timeoutPromise]);
}

/**
 * Creates a NextResponse for API 404 errors with consistent format.
 */
export function apiNotFoundResponse(
  resource: string = "Resource",
  id?: string
): NextResponse {
  return NextResponse.json(
    {
      error: `${resource} not found${id ? `: ${id}` : ""}`,
      code: "NOT_FOUND",
    },
    { status: 404 }
  );
}

/**
 * Creates a NextResponse for API 405 Method Not Allowed errors.
 */
export function apiMethodNotAllowedResponse(
  allowedMethods: string[]
): NextResponse {
  return NextResponse.json(
    {
      error: `Method not allowed. Allowed: ${allowedMethods.join(", ")}`,
      code: "METHOD_NOT_ALLOWED",
    },
    {
      status: 405,
      headers: {
        Allow: allowedMethods.join(", "),
      },
    }
  );
}

/**
 * Creates a NextResponse for API 400 Bad Request errors.
 */
export function apiBadRequestResponse(
  message: string,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code: "BAD_REQUEST",
      ...(details !== undefined && { details }),
    },
    { status: 400 }
  );
}

/**
 * Creates a NextResponse for API 409 Conflict errors.
 */
export function apiConflictResponse(message: string): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code: "CONFLICT",
    },
    { status: 409 }
  );
}

/**
 * Creates a NextResponse for API 503 Service Unavailable errors.
 */
export function apiServiceUnavailableResponse(
  message: string = "Service temporarily unavailable"
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code: "SERVICE_UNAVAILABLE",
    },
    { status: 503 }
  );
}

/**
 * Standard success response wrapper with optional metadata.
 */
export function apiSuccessResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
  status: number = 200
): NextResponse {
  const body: Record<string, unknown> = { data };
  if (meta) {
    body.meta = meta;
  }
  return NextResponse.json(body, { status });
}

/**
 * Standard paginated response wrapper.
 */
export function apiPaginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
): NextResponse {
  return NextResponse.json({
    data,
    pagination,
  });
}