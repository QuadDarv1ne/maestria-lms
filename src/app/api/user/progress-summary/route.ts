import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { addRateLimitHeaders } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

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
  const session = await getAuthSession();
  if (!requireAuth(session)) return authErrorResponse();

  const userId = session.user.id;
  const responseHeaders = new Headers();
  addRateLimitHeaders(responseHeaders, "default", request, userId);

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
    const completedCourses = enrollments.filter((e) => e.status === "completed").length;
    const inProgressCourses = enrollments.filter((e) => e.status === "active").length;
    const overallProgress =
      totalEnrolled > 0
        ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / totalEnrolled)
        : 0;

    // Recent activity summary
    const recentCompletions = recentProgress.length;
    const weeklyTimeSpent = recentProgress.reduce((sum, p) => sum + p.timeSpent, 0);

    // Next lessons for active courses (first incomplete lesson)
    const nextLessons = await Promise.all(
      enrollments
        .filter((e) => e.status === "active")
        .slice(0, 5) // Limit to 5 courses
        .map(async (enrollment) => {
          // Get all lesson IDs for this course
          const allLessonIds = enrollment.course.modules.flatMap((m) =>
            m.lessons.map((l) => l.id),
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
            ).map((p) => p.lessonId),
          );

          // Find first incomplete lesson
          const nextLesson = enrollment.course.modules
            .flatMap((m) => m.lessons)
            .find((l) => !completedLessonIds.has(l.id));

          return {
            courseId: enrollment.course.id,
            courseTitle: enrollment.course.title,
            courseSlug: enrollment.course.slug,
            courseImage: enrollment.course.image,
            progress: enrollment.progress,
            nextLesson: nextLesson
              ? { id: nextLesson.id, title: nextLesson.title }
              : null,
          };
        }),
    );

    return NextResponse.json(
      {
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
      },
      { headers: responseHeaders },
    );
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