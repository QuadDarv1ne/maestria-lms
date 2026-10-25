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
    const sevenDaysAgo = new Date(now.getTime() - MS.DAY * 7);

    let totalStudents = 0;
    let totalCompleted = 0;
    let totalProgressSum = 0;
    let totalEnrollments = 0;
    const recentStudentIds = new Set<string>();
    const lowProgressStudents: Array<{
      userId: string;
      name: string | null;
      email: string;
      progress: number;
      courseId: string;
      courseTitle: string;
    }> = [];

    // Batch-fetch pending assignments (essays to review)
    const pendingAssignments = await db.assignmentSubmission.findMany({
      where: {
        assignment: {
          lesson: {
            module: {
              course: { teacherId },
            },
          },
          type: "essay",
        },
        status: "pending",
      },
      include: {
        assignment: {
          select: {
            title: true,
            lesson: {
              select: {
                title: true,
                module: {
                  select: {
                    course: {
                      select: { title: true },
                    },
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

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

      // Find low-progress students (< 30%)
      activeEnrollments.forEach((e: { enrolledAt: Date; completedAt: Date | null; userId: string; progress: number }) => {
        if (
          e.enrolledAt >= thirtyDaysAgo ||
          (e.completedAt && e.completedAt >= thirtyDaysAgo)
        ) {
          recentStudentIds.add(e.userId);
        }
        if (e.progress < 30) {
          lowProgressStudents.push({
            userId: e.userId,
            name: e.user?.name ?? null,
            email: e.user?.email ?? "",
            progress: e.progress,
            courseId: course.id,
            courseTitle: course.title,
          });
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

    // Weekly activity: last 7 days with daily stats
    const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(now);
      day.setUTCDate(day.getUTCDate() - (6 - i));
      const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
      const dayEnd = new Date(dayStart.getTime() + MS.DAY);

      return {
        date: day.toISOString().split("T")[0],
        day: getDayShort(day, "ru"),
        enrollments: 0,
        completions: 0,
        timeSpent: 0,
      };
    });

    // Batch-fetch daily stats
    const dailyProgress = await db.progress.findMany({
      where: {
        lesson: {
          module: {
            course: { teacherId },
          },
        },
        lastAccessed: { gte: sevenDaysAgo },
      },
      select: {
        lastAccessed: true,
        timeSpent: true,
        completed: true,
      },
    });

    for (const p of dailyProgress) {
      if (!p.lastAccessed) continue;
      const dayKey = p.lastAccessed.toISOString().split("T")[0];
      const dayStats = weeklyActivity.find((d) => d.date === dayKey);
      if (dayStats) {
        dayStats.timeSpent += p.timeSpent;
        if (p.completed) dayStats.completions++;
      }
    }

    // Also count enrollments this week
    const weeklyEnrollments = await db.enrollment.count({
      where: {
        course: { teacherId },
        enrolledAt: { gte: sevenDaysAgo },
      },
    });
    weeklyActivity[6].enrollments = weeklyEnrollments; // today gets enrollments

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
        pendingReviews: pendingAssignments.length,
        lowProgressStudents: lowProgressStudents.slice(0, 10),
        weeklyActivity,
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "teacher/stats" });
  }
}

function getDayShort(date: Date, locale: string): string {
  const days: Record<string, string[]> = {
    ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
    en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    zh: ["日", "一", "二", "三", "四", "五", "六"],
  };
  return (days[locale] || days.ru)[date.getDay()];
}
