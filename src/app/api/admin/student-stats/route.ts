import { NextRequest, NextResponse } from "next/server";
import { db, Prisma } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("adminStudentStats", RATE_LIMITS.admin);

// GET: Detailed statistics for a specific student
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Доступ запрещён. Требуются права администратора" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "ID пользователя обязателен" },
        { status: 400 }
      );
    }

    // Get user basic info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        bio: true,
        phone: true,
        isActive: true,
        twoFactorEnabled: true,
        createdAt: true,
        _count: {
          select: {
            enrollments: true,
            reviews: true,
            certificates: true,
            progress: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    // Get enrollments with course details and progress
    const enrollments = await db.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            image: true,
            level: true,
            category: { select: { name: true } },
            teacher: { select: { name: true } },
            _count: {
              select: {
                modules: true,
              },
            },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });

    // Get per-course lesson completion details — batched into a single query
    // instead of 5 separate queries per enrollment (N+1 problem)
    const courseIds = enrollments.map((e) => e.courseId);
    const batchedStats = await db.$queryRaw<
      Array<{
        courseId: string;
        totalLessons: bigint;
        completedLessons: bigint;
        totalTimeSpent: bigint;
        lastAccessed: Date | null;
        avgScore: number | null;
      }>
    >`
      WITH course_lessons AS (
        SELECT l.id AS lesson_id, m."courseId"
        FROM "Lesson" l
        JOIN "Module" m ON l."moduleId" = m.id
        WHERE m."courseId" IN (${Prisma.join(courseIds)})
      ),
      lesson_counts AS (
        SELECT "courseId", COUNT(*) AS "totalLessons"
        FROM course_lessons
        GROUP BY "courseId"
      ),
      completed_counts AS (
        SELECT ml."courseId", COUNT(*) AS "completedLessons"
        FROM "Progress" p
        JOIN course_lessons ml ON p."lessonId" = ml.lesson_id
        WHERE p."userId" = ${userId} AND p.completed = true
        GROUP BY ml."courseId"
      ),
      time_sums AS (
        SELECT ml."courseId", COALESCE(SUM(p."timeSpent"), 0) AS "totalTimeSpent"
        FROM "Progress" p
        JOIN course_lessons ml ON p."lessonId" = ml.lesson_id
        WHERE p."userId" = ${userId}
        GROUP BY ml."courseId"
      ),
      last_access AS (
        SELECT ml."courseId", MAX(p."lastAccessed") AS "lastAccessed"
        FROM "Progress" p
        JOIN course_lessons ml ON p."lessonId" = ml.lesson_id
        WHERE p."userId" = ${userId}
        GROUP BY ml."courseId"
      ),
      score_avgs AS (
        SELECT ml."courseId", AVG(p.score) AS "avgScore"
        FROM "Progress" p
        JOIN course_lessons ml ON p."lessonId" = ml.lesson_id
        WHERE p."userId" = ${userId} AND p.score IS NOT NULL
        GROUP BY ml."courseId"
      )
      SELECT
        lc."courseId",
        COALESCE(lc."totalLessons", 0) AS "totalLessons",
        COALESCE(cc."completedLessons", 0) AS "completedLessons",
        COALESCE(ts."totalTimeSpent", 0) AS "totalTimeSpent",
        la."lastAccessed",
        sa."avgScore"
      FROM lesson_counts lc
      LEFT JOIN completed_counts cc ON lc."courseId" = cc."courseId"
      LEFT JOIN time_sums ts ON lc."courseId" = ts."courseId"
      LEFT JOIN last_access la ON lc."courseId" = la."courseId"
      LEFT JOIN score_avgs sa ON lc."courseId" = sa."courseId"
    `;

    const statsMap = new Map(
      batchedStats.map((s) => [
        s.courseId,
        {
          totalLessons: Number(s.totalLessons),
          completedLessons: Number(s.completedLessons),
          totalTimeSpent: Number(s.totalTimeSpent),
          lastAccessed: s.lastAccessed ?? null,
          avgScore: s.avgScore ? Math.round(s.avgScore) : null,
        },
      ])
    );

    const enrollmentDetails = enrollments.map((enrollment) => {
      const stats = statsMap.get(enrollment.courseId) ?? {
        totalLessons: 0,
        completedLessons: 0,
        totalTimeSpent: 0,
        lastAccessed: null,
        avgScore: null,
      };
      return {
        ...enrollment,
        ...stats,
        lessonCompletionRate: stats.totalLessons > 0
          ? Math.round((stats.completedLessons / stats.totalLessons) * 100)
          : 0,
      };
    });

    // Get reviews with course info
    const reviews = await db.review.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get certificates
    const certificates = await db.certificate.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    });

    // Get payments
    const payments = await db.payment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute overall stats
    const totalCoursesEnrolled = enrollments.length;
    const completedCourses = enrollments.filter((e) => e.status === "completed").length;
    const inProgressCourses = enrollments.filter((e) => e.status === "active" && e.progress > 0).length;
    const notStartedCourses = enrollments.filter((e) => e.progress === 0).length;

    const totalLessonsCompleted = enrollmentDetails.reduce((sum, e) => sum + e.completedLessons, 0);
    const totalLessonsAvailable = enrollmentDetails.reduce((sum, e) => sum + e.totalLessons, 0);
    const totalTimeSpent = enrollmentDetails.reduce((sum, e) => sum + e.totalTimeSpent, 0);
    const overallAvgScore = enrollmentDetails
      .filter((e) => e.avgScore !== null)
      .reduce((sum, e, i, arr) => sum + (e.avgScore || 0) / arr.length, 0);

    // Activity: last 7 days progress count
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentProgress = await db.progress.count({
      where: {
        userId,
        lastAccessed: { gte: sevenDaysAgo },
      },
    });

    return NextResponse.json({
      user,
      enrollments: enrollmentDetails,
      reviews,
      certificates,
      payments,
      stats: {
        totalCoursesEnrolled,
        completedCourses,
        inProgressCourses,
        notStartedCourses,
        totalLessonsCompleted,
        totalLessonsAvailable,
        totalTimeSpent,
        overallAvgScore: Math.round(overallAvgScore),
        recentProgress,
        avgProgress: totalCoursesEnrolled > 0
          ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / totalCoursesEnrolled)
          : 0,
      },
    });
  } catch (error) {
    console.error("Ошибка получения статистики студента:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
