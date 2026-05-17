import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions, ExtendedSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const [userCounts, courseCounts, enrollmentAgg] = await Promise.all([
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
    ]);

    const totalUsers = userCounts.reduce((sum, g) => sum + g._count, 0);
    const totalStudents = userCounts.find((g) => g.role === "student")?._count ?? 0;
    const totalTeachers = userCounts.find((g) => g.role === "teacher")?._count ?? 0;
    const totalAdmins = userCounts.find((g) => g.role === "admin")?._count ?? 0;

    const totalRevenue = 0; // Would need payment records

    const stats = {
      totalUsers,
      totalStudents,
      totalTeachers,
      totalAdmins,
      totalCourses: courseCounts._count,
      totalPublishedCourses: await db.course.count({ where: { isPublished: true } }),
      totalEnrollments: enrollmentAgg._count,
      totalRevenue,
      activeToday: 0,
      serverUptime: process.uptime() < 3600
        ? `${Math.floor(process.uptime() / 60)} мин`
        : `${(process.uptime() / 3600).toFixed(1)} ч`,
      dbSize: "SQLite",
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Ошибка получения статистики:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
