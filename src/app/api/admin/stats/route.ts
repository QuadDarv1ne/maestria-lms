import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAdmin } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("adminStats", RATE_LIMITS.admin);

export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError as NextResponse;

    const [userCounts, courseCounts, enrollmentAgg, paymentAgg, activeUsersCount, activeWeekCount, activeMonthCount] = await Promise.all([
      db.user.groupBy({
        by: ["role"],
        _count: true,
      }),
      db.course.aggregate({
        _count: true,
        _sum: { price: true },
      }),
      db.enrollment.aggregate({
        _count: true,
      }),
      db.payment.aggregate({
        where: { status: "completed" },
        _sum: { amount: true },
        _count: true,
      }),
      db.user.count({
        where: {
          isActive: true,
          progress: {
            some: {
              lastAccessed: {
                gte: new Date(new Date().setDate(new Date().getDate() - 1)),
              },
            },
          },
        },
      }),
      db.user.count({
        where: {
          isActive: true,
          progress: {
            some: {
              lastAccessed: {
                gte: new Date(new Date().setDate(new Date().getDate() - 7)),
              },
            },
          },
        },
      }),
      db.user.count({
        where: {
          isActive: true,
          progress: {
            some: {
              lastAccessed: {
                gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
              },
            },
          },
        },
      }),
    ]);

    const totalUsers = userCounts.reduce((sum, g) => sum + g._count, 0);
    const totalStudents = userCounts.find((g) => g.role === "student")?._count ?? 0;
    const totalTeachers = userCounts.find((g) => g.role === "teacher")?._count ?? 0;
    const totalAdmins = userCounts.find((g) => g.role === "admin")?._count ?? 0;

    const totalRevenue = paymentAgg._sum.amount || 0;
    const totalPayments = paymentAgg._count || 0;

    const stats = {
      totalUsers,
      totalStudents,
      totalTeachers,
      totalAdmins,
      totalCourses: courseCounts._count,
      totalPublishedCourses: await db.course.count({ where: { isPublished: true } }),
      totalEnrollments: enrollmentAgg._count,
      totalRevenue,
      totalPayments,
      activeToday: activeUsersCount,
      activeThisWeek: activeWeekCount,
      activeThisMonth: activeMonthCount,
      serverUptime: process.uptime() < 3600
        ? `${Math.floor(process.uptime() / 60)} мин`
        : `${(process.uptime() / 3600).toFixed(1)} ч`,
      dbSize: process.env.DATABASE_URL?.startsWith("postgresql") ? "PostgreSQL"
        : process.env.DATABASE_URL?.startsWith("mysql") ? "MySQL"
        : process.env.DATABASE_URL?.startsWith("mongodb") ? "MongoDB"
        : "SQLite",
    };

    return NextResponse.json(stats);
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/stats" });
  }
}
