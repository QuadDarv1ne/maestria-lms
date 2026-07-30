import { NextResponse } from "next/server";
import { apiNotFoundResponse } from "@/lib/api-response";

/**
 * Catch-all API route for unmatched paths under /api/.
 * Returns a consistent 404 JSON response instead of the default HTML 404 page.
 *
 * This file handles:
 * - GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
 * - Any unmatched /api/* path
 */
export async function GET() {
  return apiNotFoundResponse("API endpoint");
}

export async function POST() {
  return apiNotFoundResponse("API endpoint");
}

export async function PUT() {
  return apiNotFoundResponse("API endpoint");
}

export async function PATCH() {
  return apiNotFoundResponse("API endpoint");
}

export async function DELETE() {
  return apiNotFoundResponse("API endpoint");
}

export async function HEAD() {
  return apiNotFoundResponse("API endpoint");
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}