import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("certificates", RATE_LIMITS.default);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = checkRateLimit(_request);
  if (blocked) return blocked;

  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Необходимо авторизоваться" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const certificate = await db.certificate.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            hasCertificate: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!certificate) {
      return NextResponse.json(
        { error: "Сертификат не найден" },
        { status: 404 }
      );
    }

    // Only allow the certificate owner or admins to view full details
    if (certificate.userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    return NextResponse.json({
      id: certificate.id,
      certificateNumber: certificate.certificateNumber,
      issuedAt: certificate.issuedAt,
      courseTitle: certificate.course.title,
      courseSlug: certificate.course.slug,
      userName: certificate.user.name || certificate.user.email,
      userEmail: certificate.user.email,
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "certificates/[id]" });
  }
}
