import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const updateProgressSchema = z.object({
  completed: z.boolean().optional(),
  score: z.number().int().min(0).max(100).optional().nullable(),
  timeSpent: z.number().int().min(0).optional(),
});

const checkRateLimit = rateLimit("progress", RATE_LIMITS.progress);
const checkLessonGetRateLimit = rateLimit("lessonGet", RATE_LIMITS.default);

// GET: Получить содержимое шага (урока) с полной навигацией по курсу
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const blocked = checkLessonGetRateLimit(request);
  if (blocked) return blocked;
  try {
    const { id: courseId, lessonId } = await params;

    // Получаем урок с информацией о модуле и курсе
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          select: {
            id: true,
            title: true,
            courseId: true,
            sortOrder: true,
          },
        },
        assignments: {
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            points: true,
            options: true,
            correctAnswer: true,
          },
        },
      },
    });

    if (!lesson || !lesson.module || lesson.module.courseId !== courseId) {
      return NextResponse.json(
        { error: "Шаг не найден" },
        { status: 404 }
      );
    }

    // Проверяем доступ
    let isEnrolled = false;
    let progressData = null;
    let sessionUser: { id: string } | null = null;

    const session = await getAuthSession();
    if (session?.user) {
      const userId = session.user.id;
      const enrollment = await db.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId,
          },
        },
      });
      isEnrolled = !!enrollment && enrollment.status === "active";

      // Получаем прогресс по этому уроку
      progressData = await db.progress.findUnique({
        where: {
          userId_lessonId: {
            userId,
            lessonId,
          },
        },
      });

      sessionUser = { id: userId };
    }

    // Если урок не бесплатный и пользователь не записан — доступ запрещён
    if (!lesson.isFree && !isEnrolled) {
      return NextResponse.json(
        { error: "Запишитесь на курс для доступа к этому шагу" },
        { status: 403 }
      );
    }

    // ====== Вычисляем глобальный prev/next шаг через все модули ======
    // Получаем все модули курса с их уроками, отсортированные
    const courseModules = await db.module.findMany({
      where: { courseId },
      orderBy: { sortOrder: "asc" },
      include: {
        lessons: {
          select: { id: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    // Строим плоский список всех уроков по порядку
    const allLessonsFlat = courseModules.flatMap((m) =>
      m.lessons.map((l) => ({
        id: l.id,
        moduleId: m.id,
      }))
    );

    const currentFlatIndex = allLessonsFlat.findIndex((l) => l.id === lessonId);
    const prevStepId = currentFlatIndex > 0 ? allLessonsFlat[currentFlatIndex - 1].id : null;
    const nextStepId =
      currentFlatIndex < allLessonsFlat.length - 1
        ? allLessonsFlat[currentFlatIndex + 1].id
        : null;

    // Получаем информацию о том, какие уроки уже пройдены пользователем
    let completedLessonIds: string[] = [];
    if (sessionUser) {
      const allLessonIds = allLessonsFlat.map((l) => l.id);
      const completedProgress = await db.progress.findMany({
        where: {
          userId: sessionUser.id,
          lessonId: { in: allLessonIds },
          completed: true,
        },
        select: { lessonId: true },
      });
      completedLessonIds = completedProgress.map((p) => p.lessonId);
    }

    // Скрываем correctAnswer для не записанных пользователей (даже для бесплатных уроков)
    const assignments = lesson.assignments.map((a) =>
      isEnrolled
        ? a
        : { ...a, correctAnswer: null }
    );

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        content: lesson.content,
        videoUrl: lesson.videoUrl,
        duration: lesson.duration,
        isFree: lesson.isFree,
        sortOrder: lesson.sortOrder,
        completed: completedLessonIds.includes(lessonId),
        module: lesson.module,
        assignments,
        progress: progressData || null,
        prevStepId,
        nextStepId,
        isEnrolled,
      },
      navigation: {
        totalSteps: allLessonsFlat.length,
        currentStepIndex: currentFlatIndex,
        completedSteps: completedLessonIds.length,
        prevStepId,
        nextStepId,
      },
    }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { route: "courses/[id]/lessons/[lessonId] GET" });
  }
}

// POST: Отправить прогресс / отметить шаг как пройденный
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const { id: courseId, lessonId } = await params;
    const session = await getAuthSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    // Проверяем запись на курс или бесплатность урока
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true } } },
    });

    if (!lesson || !lesson.module || lesson.module.courseId !== courseId) {
      return NextResponse.json({ error: "Шаг не найден" }, { status: 404 });
    }

    if (!lesson.isFree) {
      const enrollment = await db.enrollment.findUnique({
        where: {
          userId_courseId: { userId, courseId },
        },
      });
      if (!enrollment || enrollment.status !== "active") {
        return NextResponse.json(
          { error: "Необходимо записаться на курс" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const validation = updateProgressSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { completed, score, timeSpent } = validation.data;

    // Обновляем или создаём прогресс
    const progress = await db.progress.upsert({
      where: {
        userId_lessonId: { userId, lessonId },
      },
      create: {
        userId,
        lessonId,
        completed: completed || false,
        score: score || null,
        timeSpent: timeSpent || 0,
      },
      update: {
        completed: completed ?? undefined,
        score: score ?? undefined,
        timeSpent: timeSpent ? { increment: timeSpent } : undefined,
        lastAccessed: new Date(),
      },
    });

    // Пересчитываем общий прогресс курса
    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: {
            lessons: { select: { id: true } },
          },
        },
      },
    });

    if (course) {
      const allLessonIds = course.modules.flatMap((m) =>
        m.lessons.map((l) => l.id)
      );
      const completedLessons = await db.progress.count({
        where: {
          userId,
          lessonId: { in: allLessonIds },
          completed: true,
        },
      });

      const courseProgress =
        allLessonIds.length > 0
          ? Math.round((completedLessons / allLessonIds.length) * 100)
          : 0;

      // Обновляем enrollment
      const enrollment = await db.enrollment.findUnique({
        where: {
          userId_courseId: { userId, courseId },
        },
      });

      if (enrollment) {
        const wasAlreadyCompleted = enrollment.status === "completed";

        await db.$transaction(async (tx) => {
          await tx.enrollment.update({
            where: { id: enrollment.id },
            data: {
              progress: courseProgress,
              completedAt: courseProgress === 100 ? new Date() : null,
              status: courseProgress === 100 ? "completed" : "active",
            },
          });

          // Auto-create certificate on first-time completion (inside transaction to prevent duplicates)
          if (courseProgress === 100 && !wasAlreadyCompleted && course.hasCertificate) {
            const existingCert = await tx.certificate.findFirst({
              where: { userId, courseId },
              select: { id: true },
            });

            if (!existingCert) {
              const year = new Date().getFullYear();
              const uniqueSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
              const certNumber = `MAE-${year}-${uniqueSuffix}`;
              await tx.certificate.create({
                data: {
                  userId,
                  courseId,
                  certificateNumber: certNumber,
                },
              });
            }
          }
        });

        // Send notification on first-time completion (outside transaction, fire-and-forget)
        if (courseProgress === 100 && !wasAlreadyCompleted) {
          createNotification({
            userId,
            type: "completion",
            title: "Курс пройден!",
            message: `Поздравляем! Вы завершили курс "${course.title}"`,
            link: `course/${courseId}`,
          }).catch((err) => log.error("Failed to send completion notification", { error: err }));
        }
      }
    }

    return NextResponse.json(
      {
        message: completed ? "Шаг пройден!" : "Прогресс обновлён",
        progress,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, { route: "courses/[id]/lessons/[lessonId] POST" });
  }
}
