import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { error: "Certificate not found" },
        { status: 404 }
      );
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
  } catch (error) {
    console.error("Error fetching certificate:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
