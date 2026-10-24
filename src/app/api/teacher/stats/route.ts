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

    // Batch-fetch all enrollments and payments for all courses in parallel
    const courseIds = courses.map((c: { id: string }) => c.id);
    const [allEnrollments, allPayments] = await Promise.all([
      db.enrollment.findMany({
        where: { courseId: { in: courseIds } },
        include: {
          user: {
            select: {
              id: true, name: true, image: true,
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
      }),
      db.payment.findMany({
        where: { courseId: { in: courseIds }, status: "completed" },
        select: { courseId: true, amount: true },
      }),
    ]);

    // Group by courseId
    const enrollmentsByCourse = new Map<string, typeof allEnrollments>();
    for (const e of allEnrollments) {
      const existing = enrollmentsByCourse.get(e.courseId) ?? [];
      existing.push(e);
      enrollmentsByCourse.set(e.courseId, existing);
    }

    const paymentsByCourse = new Map<string, number>();
    for (const p of allPayments) {
      paymentsByCourse.set(p.courseId, (paymentsByCourse.get(p.courseId) ?? 0) + Number(p.amount));
    }

    const coursesWithEnrollments = courses.map((course: { id: string }) => ({
      ...course,
      enrollments: enrollmentsByCourse.get(course.id) ?? [],
      totalRevenue: paymentsByCourse.get(course.id) ?? 0,
    }));

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
      (sum: number, c: { totalRevenue: number }) => sum + c.totalRevenue,
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
