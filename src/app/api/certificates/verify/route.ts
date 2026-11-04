import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-errors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("certificateVerify", RATE_LIMITS.certificateVerify);

/**
 * Public certificate verification endpoint.
 *
 * GET /api/certificates/verify?number=MAE-2026-ABC12345
 *
 * Returns certificate data (user name, course title, issue date) if the
 * number is valid, or 404 if not found. No authentication required.
 * Rate-limited to 10 requests per minute per IP.
 */
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const { searchParams } = new URL(request.url);
    const number = searchParams.get("number");

    if (!number || !number.trim()) {
      return NextResponse.json(
        { error: "Certificate number is required" },
        { status: 400 }
      );
    }

    const certificate = await db.certificate.findUnique({
      where: { certificateNumber: number.trim().toUpperCase() },
      select: {
        certificateNumber: true,
        issuedAt: true,
        user: { select: { name: true, email: true } },
        course: { select: { title: true, slug: true } },
      },
    });

    if (!certificate) {
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      certificate: {
        number: certificate.certificateNumber,
        issuedAt: certificate.issuedAt,
        userName: certificate.user.name || certificate.user.email,
        courseTitle: certificate.course.title,
        courseSlug: certificate.course.slug,
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "certificates/verify GET" });
  }
}
