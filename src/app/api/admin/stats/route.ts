import { NextRequest, NextResponse } from "next/server";
import { db, getDatabaseProvider } from "@/lib/db";
import { getAuthSession, requireAdmin, adminErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("adminStats", RATE_LIMITS.admin);

export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    if (!requireAdmin(session)) return adminErrorResponse();

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 86_400_000);
    const oneWeekAgo = new Date(now.getTime() - 604_800_000);
    const oneMonthAgo = new Date(now.getTime() - 2_592_000_000);

    const [
      userCounts,
      courseCounts,
      publishedCourseCount,
      enrollmentAgg,
      paymentAgg,
      activeUsersCount,
      activeWeekCount,
      activeMonthCount,
    ] = await Promise.all([
      db.user.groupBy({
        by: ["role"],
        _count: true,
      }),
      db.course.aggregate({
        _count: true,
        _sum: { price: true },
      }),
      db.course.count({ where: { isPublished: true } }),
      db.enrollment.aggregate({
        _count: true,
      }),
      db.payment.aggregate({
        where: { status: "completed" },
        _sum: { amount: true },
        _count: true,
      }),
      // Count distinct users with progress accessed in last day
      // Using groupBy for cross-provider compatibility (distinct in count is PG/Mongo only)
      db.progress.groupBy({
        by: ["userId"],
        where: { lastAccessed: { gte: oneDayAgo } },
        _count: { userId: true },
      }).then((r: { userId: string }[]) => r.length),
      // Count distinct users with progress accessed in last week
      db.progress.groupBy({
        by: ["userId"],
        where: { lastAccessed: { gte: oneWeekAgo } },
        _count: { userId: true },
      }).then((r: { userId: string }[]) => r.length),
      // Count distinct users with progress accessed in last month
      db.progress.groupBy({
        by: ["userId"],
        where: { lastAccessed: { gte: oneMonthAgo } },
        _count: { userId: true },
      }).then((r: { userId: string }[]) => r.length),
    ]);

    const totalUsers = userCounts.reduce((sum: number, g: { role: string; _count: number }) => sum + g._count, 0);
    const totalStudents = userCounts.find((g: { role: string; _count: number }) => g.role === "student")?._count ?? 0;
    const totalTeachers = userCounts.find((g: { role: string; _count: number }) => g.role === "teacher")?._count ?? 0;
    const totalAdmins = userCounts.find((g: { role: string; _count: number }) => g.role === "admin")?._count ?? 0;

    const totalRevenue = paymentAgg._sum.amount || 0;
    const totalPayments = paymentAgg._count || 0;

    const stats = {
      totalUsers,
      totalStudents,
      totalTeachers,
      totalAdmins,
      totalCourses: courseCounts._count,
      totalPublishedCourses: publishedCourseCount,
      totalEnrollments: enrollmentAgg._count,
      totalRevenue,
      totalPayments,
      activeToday: activeUsersCount,
      activeThisWeek: activeWeekCount,
      activeThisMonth: activeMonthCount,
      serverUptime: process.uptime() < 3600
        ? `${Math.floor(process.uptime() / 60)} мин`
        : `${(process.uptime() / 3600).toFixed(1)} ч`,
      dbSize: ({ postgresql: "PostgreSQL", mysql: "MySQL", mongodb: "MongoDB" } as Record<string, string>)[getDatabaseProvider()] ?? "SQLite",
    };

    return NextResponse.json(stats);
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/stats" });
  }
}
