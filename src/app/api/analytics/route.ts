import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { log } from "@/lib/logger";
import { addRateLimitHeaders } from "@/lib/rate-limit";

/**
 * GET /api/analytics
 *
 * Returns aggregated analytics data for the authenticated user:
 * - Total courses enrolled
 * - Courses completed
 * - Overall progress percentage
 * - Total time spent (seconds)
 * - Lessons completed
 * - Assignments submitted/graded
 * - Certificates earned
 * - Reviews written
 * - Activity timeline (last 30 days)
 * - Streak data (consecutive days with activity)
 */
export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!requireAuth(session)) {
    return authErrorResponse();
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get("days") ?? "30", 10) || 30, 1), 365);

  const responseHeaders = new Headers();
  addRateLimitHeaders(responseHeaders, "default", request, userId);

  try {
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Run all queries in parallel for performance
    const [
      enrollments,
      progressRecords,
      certificates,
      reviews,
      submissions,
      recentProgress,
    ] = await Promise.all([
      // Enrollment stats
      db.enrollment.findMany({
        where: { userId },
        select: { id: true, status: true, progress: true, enrolledAt: true, completedAt: true },
      }),

      // All progress records for time calculation
      db.progress.findMany({
        where: { userId },
        select: { completed: true, timeSpent: true, lastAccessed: true, score: true },
      }),

      // Certificates
      db.certificate.findMany({
        where: { userId },
        select: { id: true, issuedAt: true },
      }),

      // Reviews
      db.review.findMany({
        where: { userId },
        select: { id: true, createdAt: true },
      }),

      // Assignment submissions
      db.assignmentSubmission.findMany({
        where: { userId },
        select: { id: true, status: true, score: true, submittedAt: true },
      }),

      // Recent activity (progress updates in the period)
      db.progress.findMany({
        where: {
          userId,
          lastAccessed: { gte: since },
        },
        select: { lastAccessed: true, completed: true, timeSpent: true },
        orderBy: { lastAccessed: "desc" },
      }),
    ]);

    // Compute enrollment stats
    const totalEnrolled = enrollments.length;
    const completedCourses = enrollments.filter((e) => e.status === "completed").length;
    const activeCourses = enrollments.filter((e) => e.status === "active").length;
    const overallProgress =
      totalEnrolled > 0
        ? Math.round(
            enrollments.reduce((sum, e) => sum + e.progress, 0) / totalEnrolled,
          )
        : 0;

    // Compute lesson stats
    const lessonsCompleted = progressRecords.filter((p) => p.completed).length;
    const totalTimeSpent = progressRecords.reduce((sum, p) => sum + p.timeSpent, 0);
    const averageScore =
      progressRecords.filter((p) => p.score !== null).length > 0
        ? Math.round(
            progressRecords
              .filter((p) => p.score !== null)
              .reduce((sum, p) => sum + (p.score ?? 0), 0) /
              progressRecords.filter((p) => p.score !== null).length,
          )
        : null;

    // Assignment stats
    const assignmentsSubmitted = submissions.length;
    const assignmentsGraded = submissions.filter((s) => s.status === "graded").length;
    const averageAssignmentScore =
      submissions.filter((s) => s.score !== null).length > 0
        ? Math.round(
            submissions
              .filter((s) => s.score !== null)
              .reduce((sum, s) => sum + (s.score ?? 0), 0) /
              submissions.filter((s) => s.score !== null).length,
          )
        : null;

    // Build activity timeline (daily activity counts for the period)
    const activityMap = new Map<string, number>();
    for (const record of recentProgress) {
      const dayKey = record.lastAccessed.toISOString().slice(0, 10);
      activityMap.set(dayKey, (activityMap.get(dayKey) ?? 0) + 1);
    }

    const activityTimeline: Array<{ date: string; count: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      activityTimeline.push({ date: key, count: activityMap.get(key) ?? 0 });
    }

    // Compute streak (consecutive days with activity)
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    for (const entry of activityTimeline) {
      if (entry.count > 0) {
        tempStreak++;
        currentStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    // If today has no activity yet, check if yesterday had activity for streak
    if (activityTimeline.length > 0 && activityTimeline[activityTimeline.length - 1].count === 0) {
      currentStreak = 0;
      // Recalculate from the last activity day
      for (let i = activityTimeline.length - 2; i >= 0; i--) {
        if (activityTimeline[i].count > 0) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Weekly activity summary
    const weeklyActivity: Array<{ week: string; count: number }> = [];
    const weekMap = new Map<string, number>();
    for (const entry of activityTimeline) {
      const date = new Date(entry.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);
      weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + entry.count);
    }
    for (const [week, count] of weekMap) {
      weeklyActivity.push({ week, count });
    }
    weeklyActivity.sort((a, b) => a.week.localeCompare(b.week));

    return NextResponse.json(
      {
        data: {
          overview: {
            totalEnrolled,
            activeCourses,
            completedCourses,
            overallProgress,
            totalTimeSpent,
            lessonsCompleted,
            averageScore,
          },
          assignments: {
            submitted: assignmentsSubmitted,
            graded: assignmentsGraded,
            averageScore: averageAssignmentScore,
          },
          achievements: {
            certificatesEarned: certificates.length,
            reviewsWritten: reviews.length,
          },
          activity: {
            timeline: activityTimeline,
            weeklySummary: weeklyActivity,
            currentStreak,
            longestStreak,
            totalActiveDays: activityMap.size,
          },
        },
      },
      { headers: responseHeaders },
    );
  } catch (error: unknown) {
    log.error("Failed to fetch analytics", {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    return NextResponse.json(
      { error: "Failed to fetch analytics data", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}