import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

const checkRateLimit = rateLimit("progress-summary", RATE_LIMITS.default);

/**
 * GET /api/user/progress-summary
 *
 * Lightweight endpoint returning a summary of the user's learning progress.
 * More efficient than fetching full analytics for dashboard widgets.
 *
 * Returns:
 * - Total enrolled courses count
 * - Completed courses count
 * - In-progress courses count
 * - Overall progress percentage
 * - Recent activity (last 7 days lesson completions)
 * - Next incomplete lesson per active course
 */
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const session = await getAuthSession();
  if (!requireAuth(session)) return authErrorResponse();

  const userId = session.user.id;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [enrollments, recentProgress] = await Promise.all([
      // All enrollments with course info
      db.enrollment.findMany({
        where: { userId },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              image: true,
              modules: {
                select: {
                  lessons: {
                    select: { id: true, title: true, sortOrder: true },
                    orderBy: { sortOrder: "asc" },
                  },
                },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
      }),

      // Recent completions
      db.progress.findMany({
        where: {
          userId,
          completed: true,
          lastAccessed: { gte: sevenDaysAgo },
        },
        select: { lessonId: true, lastAccessed: true, timeSpent: true },
        orderBy: { lastAccessed: "desc" },
      }),
    ]);

    // Compute stats
    const totalEnrolled = enrollments.length;
    const completedCourses = enrollments.filter((e: { status: string }) => e.status === "completed").length;
    const inProgressCourses = enrollments.filter((e: { status: string }) => e.status === "active").length;
    const overallProgress =
      totalEnrolled > 0
        ? Math.round(enrollments.reduce((sum: number, e: { progress: number }) => sum + e.progress, 0) / totalEnrolled)
        : 0;

    // Recent activity summary
    const recentCompletions = recentProgress.length;
    const weeklyTimeSpent = recentProgress.reduce((sum: number, p: { timeSpent: number }) => sum + p.timeSpent, 0);

    // Next lessons for active courses (first incomplete lesson)
    const nextLessons = await Promise.all(
      enrollments
        .filter((e: { status: string }) => e.status === "active")
        .slice(0, 5) // Limit to 5 courses
        .map(async (enrollment: { course: { modules: { lessons: { id: string }[] }[]; id: string; title: string; slug: string; image: string | null }; status: string; progress: number }) => {
          // Get all lesson IDs for this course
          const allLessonIds = enrollment.course.modules.flatMap((m: { lessons: { id: string }[] }) =>
            m.lessons.map((l: { id: string }) => l.id),
          );

          // Get completed lesson IDs
          const completedLessonIds = new Set(
            (
              await db.progress.findMany({
                where: {
                  userId,
                  lessonId: { in: allLessonIds },
                  completed: true,
                },
                select: { lessonId: true },
              })
            ).map((p: { lessonId: string }) => p.lessonId),
          );

          // Find first incomplete lesson
          const allLessons = (enrollment.course.modules as unknown as { lessons: { id: string; title: string }[] }[]).flatMap(m => m.lessons);
          const nextLesson: { id: string; title: string } | undefined = allLessons.find((l: { id: string; title: string }) => !completedLessonIds.has(l.id));

          return {
            courseId: enrollment.course.id,
            courseTitle: enrollment.course.title,
            courseSlug: enrollment.course.slug,
            courseImage: enrollment.course.image,
            progress: enrollment.progress,
            nextLesson: nextLesson
              ? { id: (nextLesson as { id: string; title: string }).id, title: (nextLesson as { id: string; title: string }).title }
              : null,
          };
        }),
    );

    return NextResponse.json({
        data: {
          overview: {
            totalEnrolled,
            completedCourses,
            inProgressCourses,
            overallProgress,
          },
          recentActivity: {
            lessonsCompletedLast7Days: recentCompletions,
            timeSpentLast7Days: weeklyTimeSpent,
          },
          nextLessons,
        },
      });
  } catch (error: unknown) {
    log.error("Failed to fetch progress summary", {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    return NextResponse.json(
      { error: "Failed to fetch progress summary", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}