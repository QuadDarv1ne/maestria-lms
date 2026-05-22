import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Необходимо авторизоваться" }, { status: 401 });
  }

  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const teacherId = session.user.id;

    const courses = await db.course.findMany({
      where: { teacherId },
      include: {
        category: { select: { name: true, slug: true } },
        enrollments: {
          include: {
            user: {
              select: {
                id: true, name: true, email: true, image: true,
              },
            },
          },
        },
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

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalStudents = 0;
    let totalCompleted = 0;
    let totalProgressSum = 0;
    let totalEnrollments = 0;
    const recentStudentIds = new Set<string>();

    const coursesWithStats = courses.map((course) => {
      const activeEnrollments = course.enrollments.filter(
        (e) => e.status === "active"
      );
      const completedEnrollments = course.enrollments.filter(
        (e) => e.status === "completed"
      );
      const totalForCourse = course.enrollments.length;

      totalStudents += activeEnrollments.length;
      totalCompleted += completedEnrollments.length;
      totalProgressSum += course.enrollments.reduce(
        (sum, e) => sum + e.progress,
        0
      );
      totalEnrollments += totalForCourse;

      course.enrollments.forEach((e) => {
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
              course.enrollments.reduce((s, e) => s + e.progress, 0) /
                totalForCourse
            )
          : 0,
        recentEnrollments: activeEnrollments
          .sort(
            (a, b) =>
              new Date(b.enrolledAt).getTime() -
              new Date(a.enrolledAt).getTime()
          )
          .slice(0, 5)
          .map((e) => ({
            userId: e.userId,
            name: e.user.name,
            email: e.user.email,
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

    const totalRevenue = courses.reduce(
      (sum, c) =>
        sum +
        c.enrollments.filter((e) => e.status === "completed" || e.status === "active").length *
          c.price,
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
  } catch (error) {
    console.error("Ошибка получения статистики преподавателя:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
