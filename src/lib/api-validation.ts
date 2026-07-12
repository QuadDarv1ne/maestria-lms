import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Validate search params against a Zod schema.
 * Returns parsed data or a 400 NextResponse on failure.
 */
export function validateSearchParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>,
): T | NextResponse {
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const result = schema.safeParse(raw);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "Invalid query parameters" },
      { status: 400 },
    );
  }
  return result.data;
}


