import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

const checkRateLimit = rateLimit("course-students", RATE_LIMITS.default);

/**
 * GET /api/courses/[id]/students
 *
 * Returns the list of enrolled students for a course.
 * Accessible by the course teacher or admin.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const session = await getAuthSession();
  if (!requireAuth(session)) return authErrorResponse();

  const { id } = await params;
  const userId = session.user.id;
  const isAdmin = session.user.role === "admin";

  try {
    // Verify course exists and check access (support both UUID and slug)
    const course = await db.course.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, teacherId: true, title: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Use resolved course.id for all DB operations
    const resolvedCourseId = course.id;

    // Only teacher of the course or admin can view students
    if (course.teacherId !== userId && !isAdmin) {
      return NextResponse.json(
        { error: "Access denied. Only the course teacher or admin can view students.", code: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1), 100);
    const status = searchParams.get("status") ?? null;
    const search = searchParams.get("search") ?? null;

    // Build where clause
    const where: Prisma.EnrollmentWhereInput = { courseId: resolvedCourseId };
    if (status) {
      where.status = status;
    }

    // Get enrollments with user data
    const [enrollments, total] = await Promise.all([
      db.enrollment.findMany({
        where,
        orderBy: { enrolledAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              role: true,
              createdAt: true,
            },
          },
        },
      }),
      db.enrollment.count({ where }),
    ]);

    // Filter by search if provided
    let filteredEnrollments = enrollments;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredEnrollments = enrollments.filter(
        (e) =>
          e.user.name?.toLowerCase().includes(searchLower) ||
          e.user.email.toLowerCase().includes(searchLower),
      );
    }

    const students = filteredEnrollments.map((e) => ({
      id: e.id,
      enrolledAt: e.enrolledAt.toISOString(),
      completedAt: e.completedAt?.toISOString() ?? null,
      status: e.status,
      progress: e.progress,
      user: {
        id: e.user.id,
        name: e.user.name,
        email: e.user.email,
        image: e.user.image,
        role: e.user.role,
        registeredAt: e.user.createdAt.toISOString(),
      },
    }));

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
        data: students,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
  } catch (error: unknown) {
    log.error("Failed to fetch course students", {
      error: error instanceof Error ? error.message : String(error),
      courseId: id,
    });
    return NextResponse.json(
      { error: "Failed to fetch students", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}