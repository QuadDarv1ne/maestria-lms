/**
 * API Request Validation Middleware
 *
 * Provides reusable validation helpers for API routes.
 * Combines Zod schema validation with standardized error responses.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-errors";

/**
 * Validated request body with proper typing.
 * Returns parsed data or a 400 NextResponse.
 */
export function validateBody<T>(
  body: unknown,
  schema: z.ZodSchema<T>,
): { data: T } | { response: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return {
      response: NextResponse.json(
        { error: firstIssue?.message ?? "Ошибка валидации" },
        { status: 400 },
      ),
    };
  }
  return { data: result.data };
}

/**
 * Validated query parameters from URLSearchParams.
 * Returns parsed data or a 400 NextResponse.
 */
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>,
): { data: T } | { response: NextResponse } {
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const result = schema.safeParse(raw);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return {
      response: NextResponse.json(
        { error: firstIssue?.message ?? "Invalid query parameters" },
        { status: 400 },
      ),
    };
  }
  return { data: result.data };
}

/**
 * Common pagination query schema.
 * Use in any list endpoint that needs pagination.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/**
 * Common search query schema.
 * Extends pagination with search and sort fields.
 */
export const searchSchema = paginationSchema.extend({
  search: z.string().optional(),
  sortBy: z.string().optional(),
});

export type SearchInput = z.infer<typeof searchSchema>;

/**
 * UUID or slug param schema.
 * Use for route params that accept either UUID or slug.
 */
export const idOrSlugSchema = z.string().min(1, "ID or slug is required");

/**
 * Safe JSON parse helper.
 * Parses JSON strings safely, returning undefined on failure.
 */
export function safeJsonParse<T>(json: string | null | undefined, fallback?: T): T | undefined {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Wraps an async API route handler with standardized error handling.
 * Catches all errors and returns appropriate responses.
 */
export function withErrorHandling<T>(
  handler: () => Promise<NextResponse<T>>,
  context?: Record<string, unknown>,
): Promise<NextResponse<T>> {
  return handler().catch((error) => {
    return handleApiError(error, context) as unknown as Promise<NextResponse<T>>;
  });
}