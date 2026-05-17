import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions, ExtendedSession } from "@/lib/auth";

// GET: Detailed statistics for a specific student
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
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

    // Get per-course lesson completion details
    const enrollmentDetails = await Promise.all(
      enrollments.map(async (enrollment) => {
        const totalLessons = await db.lesson.count({
          where: {
            module: {
              courseId: enrollment.courseId,
            },
          },
        });

        const completedLessons = await db.progress.count({
          where: {
            userId,
            completed: true,
            lesson: {
              module: {
                courseId: enrollment.courseId,
              },
            },
          },
        });

        const totalTimeSpent = await db.progress.aggregate({
          where: {
            userId,
            lesson: {
              module: {
                courseId: enrollment.courseId,
              },
            },
          },
          _sum: {
            timeSpent: true,
          },
        });

        // Get last accessed date
        const lastAccessed = await db.progress.findFirst({
          where: {
            userId,
            lesson: {
              module: {
                courseId: enrollment.courseId,
              },
            },
          },
          orderBy: { lastAccessed: "desc" },
          select: { lastAccessed: true },
        });

        // Get quiz scores
        const progressRecords = await db.progress.findMany({
          where: {
            userId,
            lesson: {
              module: {
                courseId: enrollment.courseId,
              },
            },
            score: { not: null },
          },
          select: { score: true },
        });

        const avgScore = progressRecords.length > 0
          ? Math.round(progressRecords.reduce((sum, p) => sum + (p.score || 0), 0) / progressRecords.length)
          : null;

        return {
          ...enrollment,
          totalLessons,
          completedLessons,
          totalTimeSpent: totalTimeSpent._sum?.timeSpent || 0,
          lastAccessed: lastAccessed?.lastAccessed || null,
          avgScore,
          lessonCompletionRate: totalLessons > 0
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0,
        };
      })
    );

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
