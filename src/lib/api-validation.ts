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

/**
 * Validate JSON request body against a Zod schema.
 * Returns parsed data or a 400 NextResponse on failure.
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<T | NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "Invalid request body" },
      { status: 400 },
    );
  }
  return result.data;
}
