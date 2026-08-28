import { NextRequest, NextResponse } from "next/server";
import { db, Prisma } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("profile", RATE_LIMITS.profile);
const checkProfileGetRateLimit = rateLimit("profileGet", RATE_LIMITS.profile);

const updateProfileSchema = z.object({
  name: z.string().min(2, "Имя должно быть не менее 2 символов").max(50).optional(),
  bio: z.string().max(500, "Биография слишком длинная").optional(),
  phone: z.string().max(20).regex(/^[\d\s+\-()]*$/, "Неверный формат телефона").optional(),
  image: z.string().url("Неверный URL изображения").optional().or(z.literal("")),
});

// GET: Профиль текущего пользователя
export async function GET(request: NextRequest) {
  const blocked = checkProfileGetRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const userId = session.user.id;

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
        twoFactorEnabled: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        _count: {
          select: {
            enrollments: true,
            reviews: true,
            certificates: true,
            teacherCourses: true,
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

    // Параллельные запросы: записи на курсы, прогресс, сертификаты
    const [enrollments, progress, certificates] = await Promise.all([
      db.enrollment.findMany({
        where: { userId },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              image: true,
              level: true,
              modules: {
                select: {
                  lessons: {
                    select: {
                      id: true,
                      duration: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
      }),
      db.progress.findMany({
        where: { userId },
        select: {
          lessonId: true,
          completed: true,
          timeSpent: true,
          score: true,
          lastAccessed: true,
        },
        take: 1000,
        orderBy: { lastAccessed: "desc" },
      }),
      db.certificate.findMany({
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
        take: 50,
      }),
    ]);

    // Build lessonId → progress lookup
    const progressMap = new Map(progress.map((p: { lessonId: string }) => [p.lessonId, p]));

    // Compute per-enrollment stats server-side to eliminate N+1 client fetches
    const enrollmentDetails = enrollments.map((enrollment: { course: { modules: { lessons: { id: string }[] }[]; id: string; title: string; image: string | null; level: string }; id: string; status: string; progress: number; enrolledAt: Date }) => {
      const lessons = enrollment.course.modules.flatMap((m: { lessons: { id: string }[] }) => m.lessons);
      const totalLessons = lessons.length;

      let completedLessons = 0;
      let totalTimeSpent = 0;
      let lastAccessed: Date | null = null;
      const scores: number[] = [];

      for (const lesson of lessons) {
        const p = progressMap.get(lesson.id) as { completed: boolean; timeSpent: number; score: number | null; lastAccessed: Date } | undefined;
        if (!p) continue;
        if (p.completed) completedLessons++;
        totalTimeSpent += p.timeSpent;
        if (p.score !== null) scores.push(p.score);
        if (!lastAccessed || p.lastAccessed > lastAccessed) {
          lastAccessed = p.lastAccessed;
        }
      }

      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

      return {
        id: enrollment.id,
        status: enrollment.status,
        progress: enrollment.progress,
        enrolledAt: enrollment.enrolledAt,
        course: {
          id: enrollment.course.id,
          title: enrollment.course.title,
          image: enrollment.course.image,
          level: enrollment.course.level,
        },
        totalLessons,
        completedLessons,
        totalTimeSpent,
        lastAccessed: lastAccessed?.toISOString() ?? null,
        avgScore,
      };
    });

    // Strip internal modules data from enrollments — only send what the client needs
    const enrollmentsForClient = enrollments.map((enrollment: { course: { modules: unknown[] } & Record<string, unknown>; id: string; status: string; progress: number; enrolledAt: Date }) => {
      const { modules: _modules, ...courseRest } = enrollment.course;
      const { course: _course, ...rest } = enrollment;
      return {
        ...rest,
        course: courseRest,
      };
    });

    return NextResponse.json({
      user,
      enrollments: enrollmentsForClient,
      enrollmentDetails,
      certificates,
    }, { status: 200 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "profile GET" });
  }
}

// PUT: Обновить профиль
export async function PUT(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const userId = session.user.id;

    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (validation.data.name !== undefined) updateData.name = validation.data.name;
    if (validation.data.bio !== undefined) updateData.bio = validation.data.bio;
    if (validation.data.phone !== undefined) updateData.phone = validation.data.phone;
    if (validation.data.image !== undefined) updateData.image = validation.data.image || null;

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        bio: true,
        phone: true,
        twoFactorEnabled: true,
      },
    });

    return NextResponse.json(
      { message: "Профиль обновлён", user: updatedUser },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "profile PUT" });
  }
}
