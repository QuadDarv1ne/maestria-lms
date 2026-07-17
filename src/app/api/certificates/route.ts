import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, type ExtendedSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("certificates", RATE_LIMITS.default);

const certQuerySchema = z.object({
  courseId: z.string().uuid("Неверный формат courseId"),
});

export async function GET(request: NextRequest) {
  try {
    const blocked = checkRateLimit(request);
    if (blocked) return blocked;
    const session = await getAuthSession();
    const authError = requireAuth(session);
    if (authError) return authError;

    const url = new URL(request.url);
    const parsed = certQuerySchema.safeParse({
      courseId: url.searchParams.get("courseId"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Неверный параметр" },
        { status: 400 }
      );
    }

    const { courseId } = parsed.data;

    const authSession = session as ExtendedSession;
    const certificate = await db.certificate.findUnique({
      where: {
        userId_courseId: {
          userId: authSession.user.id,
          courseId,
        },
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            hasCertificate: true,
          },
        },
      },
    });

    if (!certificate) {
      return NextResponse.json(
        { error: "Сертификат для этого курса не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: certificate.id,
      certificateNumber: certificate.certificateNumber,
      issuedAt: certificate.issuedAt,
      courseTitle: certificate.course.title,
      courseSlug: certificate.course.slug,
      userName: authSession.user.name || authSession.user.email,
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "certificates" });
  }
}
