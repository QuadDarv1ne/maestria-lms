import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-errors";
import { rateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";
import { MAX_BATCH, recordWebVitals } from "@/lib/web-vitals";

export const runtime = "nodejs";

/**
 * POST /api/web-vitals — collect Core Web Vitals from the browser.
 *
 * Public and unauthenticated by design (the reporting component mounts on the
 * landing page too), so the endpoint is deliberately boring: it accepts a
 * bounded batch of numbers and answers 204 without echoing anything. Rate
 * limited per IP; the payload cap keeps a hostile client from filling Redis.
 *
 * Always answers 204 — even for malformed input or a disabled Redis — because
 * the browser uses `navigator.sendBeacon()` and never reads the response.
 */
export async function POST(request: NextRequest) {
  try {
    const { response: limited } = await rateLimitAsync("webVitals", request, {
      windowMs: RATE_LIMITS.webVitals.windowMs,
      maxRequests: RATE_LIMITS.webVitals.maxRequests,
    });
    if (limited) return limited;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new NextResponse(null, { status: 204 });
    }

    const samples = Array.isArray(body)
      ? body
      : body && typeof body === "object" && Array.isArray((body as { samples?: unknown }).samples)
        ? (body as { samples: unknown[] }).samples
        : null;

    if (!samples || samples.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    await recordWebVitals(samples.slice(0, MAX_BATCH));
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "web-vitals POST" });
  }
}
