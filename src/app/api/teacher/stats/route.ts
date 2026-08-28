import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { MS } from "@/lib/constants";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("teacher-stats", RATE_LIMITS.default);

export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    if (session.user.role !== "teacher" && session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён. Требуются права преподавателя или администратора" }, { status: 403 });
    }

    const teacherId = session.user.id;

    const courses = await db.course.findMany({
      where: { teacherId },
      include: {
        category: { select: { name: true, slug: true } },
        _count: {
          select: {
            enrollments: true,
            modules: true,
            reviews: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch enrollments and payments for each course separately
    const coursesWithEnrollments = await Promise.all(
      courses.map(async (course: { id: string }) => {
        const enrollments = await db.enrollment.findMany({
          where: { courseId: course.id },
          include: {
            user: {
              select: {
                id: true, name: true, image: true,
              },
            },
          },
          orderBy: { enrolledAt: "desc" },
        });

        const payments = await db.payment.findMany({
          where: { courseId: course.id, status: "completed" },
          select: { amount: true },
        });

        return { ...course, enrollments, payments };
      })
    );

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - MS.THIRTY_DAYS);

    let totalStudents = 0;
    let totalCompleted = 0;
    let totalProgressSum = 0;
    let totalEnrollments = 0;
    const recentStudentIds = new Set<string>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coursesWithStats = coursesWithEnrollments.map((course: any) => {
      const enrollments = course.enrollments;
      const activeEnrollments = enrollments.filter(
        (e: { status: string }) => e.status === "active"
      );
      const completedEnrollments = enrollments.filter(
        (e: { status: string }) => e.status === "completed"
      );
      const totalForCourse = enrollments.length;

      totalStudents += activeEnrollments.length;
      totalCompleted += completedEnrollments.length;
      totalProgressSum += enrollments.reduce(
        (sum: number, e: { progress: number }) => sum + e.progress,
        0
      );
      totalEnrollments += totalForCourse;

      enrollments.forEach((e: { enrolledAt: Date; completedAt: Date | null; userId: string }) => {
        if (
          e.enrolledAt >= thirtyDaysAgo ||
          (e.completedAt && e.completedAt >= thirtyDaysAgo)
        ) {
          recentStudentIds.add(e.userId);
        }
      });

      return {
        id: course.id,
        title: course.title,
        slug: course.slug,
        isPublished: course.isPublished,
        rating: course.rating,
        category: course.category,
        enrolledStudents: activeEnrollments.length,
        completedStudents: completedEnrollments.length,
        totalEnrollments: totalForCourse,
        averageProgress: totalForCourse > 0
          ? Math.round(
              enrollments.reduce((s: number, e: { progress: number }) => s + e.progress, 0) /
                totalForCourse
            )
          : 0,
        recentEnrollments: activeEnrollments
          .sort(
            (a: { enrolledAt: Date }, b: { enrolledAt: Date }) =>
              new Date(b.enrolledAt).getTime() -
              new Date(a.enrolledAt).getTime()
          )
          .slice(0, 5)
          .map((e: { userId: string; user: { name: string | null; image: string | null }; progress: number; enrolledAt: Date }) => ({
            userId: e.userId,
            name: e.user.name,
            image: e.user.image,
            progress: e.progress,
            enrolledAt: e.enrolledAt,
          })),
        moduleCount: course._count.modules,
        reviewCount: course._count.reviews,
      };
    });

    const avgCompletionRate =
      totalEnrollments > 0
        ? Math.round((totalCompleted / totalEnrollments) * 100)
        : 0;

    const avgProgress =
      totalEnrollments > 0
        ? Math.round(totalProgressSum / totalEnrollments)
        : 0;

    const totalRevenue = coursesWithEnrollments.reduce(
      (sum: number, c) => sum + c.payments.reduce((pSum: number, p: { amount: number }) => pSum + Number(p.amount), 0),
      0
    );

    return NextResponse.json({
      courses: coursesWithStats,
      stats: {
        totalCourses: courses.length,
        totalStudents,
        totalCompleted,
        avgCompletionRate,
        avgProgress,
        totalRevenue,
        recentStudents: recentStudentIds.size,
        publishedCourses: courses.filter((c) => c.isPublished).length,
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "teacher/stats" });
  }
}
