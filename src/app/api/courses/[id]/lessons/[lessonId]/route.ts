import { NextRequest, NextResponse } from "next/server";
import { db, Prisma } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { CERTIFICATE_PREFIX } from "@/lib/constants";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { certificateEmail } from "@/lib/emails";
import { validateParams, idOrSlugSchema, uuidSchema } from "@/lib/request-validation";

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
    const paramCheck = validateParams(
      { id: courseId, lessonId },
      z.object({ id: idOrSlugSchema, lessonId: uuidSchema }),
    );
    if ("response" in paramCheck) return paramCheck.response;

    // Resolve course ID (support both UUID and slug)
    const course = await db.course.findFirst({
      where: { OR: [{ id: courseId }, { slug: courseId }] },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Шаг не найден" },
        { status: 404 }
      );
    }

    const resolvedCourseId = course.id;

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
            maxAttempts: true,
            timeLimit: true,
          },
        },
      },
    });

    if (!lesson || !lesson.module || lesson.module.courseId !== resolvedCourseId) {
      return NextResponse.json(
        { error: "Шаг не найден" },
        { status: 404 }
      );
    }

    // Проверяем доступ
    let isEnrolled = false;
    let progressData = null;
    let completedLessonIds: string[] = [];

    const session = await getAuthSession();
    if (session?.user) {
      const userId = session.user.id;

      // Parallel: enrollment, progress, and completed lessons
      const [enrollmentResult, progressResult, completedProgress] = await Promise.all([
        db.enrollment.findUnique({
          where: {
            userId_courseId: {
              userId,
              courseId: resolvedCourseId,
            },
          },
          select: { status: true },
        }),
        db.progress.findUnique({
          where: {
            userId_lessonId: {
              userId,
              lessonId,
            },
          },
        }),
        db.progress.findMany({
          where: {
            userId,
            lesson: { module: { courseId: resolvedCourseId } },
            completed: true,
          },
          select: { lessonId: true },
        }),
      ]);

      isEnrolled = !!enrollmentResult && enrollmentResult.status === "active";
      progressData = progressResult;
      completedLessonIds = completedProgress.map((p: { lessonId: string }) => p.lessonId);
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
      where: { courseId: resolvedCourseId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        lessons: {
          select: { id: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    // Строим плоский список всех уроков по порядку
    const allLessonsFlat = courseModules.flatMap((m: { id: string; lessons: { id: string }[] }) =>
      m.lessons.map((l: { id: string }) => ({
        id: l.id,
        moduleId: m.id,
      }))
    );

    const currentFlatIndex = allLessonsFlat.findIndex((l: { id: string; moduleId: string }) => l.id === lessonId);
    const prevStepId = currentFlatIndex > 0 ? allLessonsFlat[currentFlatIndex - 1].id : null;
    const nextStepId =
      currentFlatIndex < allLessonsFlat.length - 1
        ? allLessonsFlat[currentFlatIndex + 1].id
        : null;

    const assignments = lesson.assignments;

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
  } catch (error: unknown) {
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
    const paramCheck = validateParams(
      { id: courseId, lessonId },
      z.object({ id: idOrSlugSchema, lessonId: uuidSchema }),
    );
    if ("response" in paramCheck) return paramCheck.response;

    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const userId = session.user.id;

    // Resolve course and verify lesson access in parallel
    const [course, lesson] = await Promise.all([
      db.course.findFirst({
        where: { OR: [{ id: courseId }, { slug: courseId }] },
        select: { id: true },
      }),
      db.lesson.findUnique({
        where: { id: lessonId },
        select: {
          isFree: true,
          module: { select: { courseId: true } },
        },
      }),
    ]);

    if (!course) {
      return NextResponse.json({ error: "Шаг не найден" }, { status: 404 });
    }

    if (!lesson || !lesson.module || lesson.module.courseId !== course.id) {
      return NextResponse.json({ error: "Шаг не найден" }, { status: 404 });
    }

    const resolvedCourseId = course.id;

    if (!lesson.isFree) {
      const enrollment = await db.enrollment.findUnique({
        where: {
          userId_courseId: { userId, courseId: resolvedCourseId },
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
        completed: completed ?? false,
        score: score ?? null,
        timeSpent: timeSpent ?? 0,
        lastAccessed: new Date(),
      },
      update: {
        completed: completed ?? undefined,
        score: score ?? undefined,
        timeSpent: timeSpent ? { increment: timeSpent } : undefined,
        lastAccessed: new Date(),
      },
    });

    // Пересчитываем общий прогресс курса (parallel: lesson count + enrollment)
    const [courseData, completedLessons, enrollment] = await Promise.all([
      db.course.findUnique({
        where: { id: resolvedCourseId },
        select: {
          id: true,
          title: true,
          hasCertificate: true,
          modules: {
            select: {
              lessons: { select: { id: true } },
            },
          },
        },
      }),
      db.progress.count({
        where: {
          userId,
          lesson: { module: { courseId: resolvedCourseId } },
          completed: true,
        },
      }),
      db.enrollment.findUnique({
        where: {
          userId_courseId: { userId, courseId: resolvedCourseId },
        },
        select: { id: true, status: true },
      }),
    ]);

    const allLessonIds = courseData?.modules.flatMap((m: { lessons: { id: string }[] }) =>
      m.lessons.map((l: { id: string }) => l.id)
    ) ?? [];
    const courseProgress = allLessonIds.length > 0
      ? Math.round((completedLessons / allLessonIds.length) * 100)
      : 0;

    if (enrollment) {
      const wasAlreadyCompleted = enrollment.status === "completed";

      await db.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: {
            progress: courseProgress,
            completedAt: courseProgress === 100 ? new Date() : null,
            status: courseProgress === 100 ? "completed" : "active",
          },
        });

        // Auto-create certificate on first-time completion (inside transaction to prevent duplicates)
        if (courseProgress === 100 && !wasAlreadyCompleted && courseData?.hasCertificate) {
          const existingCert = await tx.certificate.findUnique({
            where: { userId_courseId: { userId, courseId: resolvedCourseId } },
            select: { id: true },
          });

          if (!existingCert) {
            const year = new Date().getFullYear();
            const uniqueSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
            const certNumber = `${CERTIFICATE_PREFIX}-${year}-${uniqueSuffix}`;
            await tx.certificate.create({
              data: {
                userId,
                courseId: resolvedCourseId,
                certificateNumber: certNumber,
              },
            });
          }
        }
      });

      // Send notification + certificate email on first-time completion (outside transaction, fire-and-forget)
      if (courseProgress === 100 && !wasAlreadyCompleted) {
        createNotification({
          userId,
          type: "completion",
          title: "Курс пройден!",
          message: `Поздравляем! Вы завершили курс "${courseData?.title}"`,
          link: courseData ? `/course/${courseData.id}` : undefined,
        }).catch((err: unknown) => log.error("Failed to send completion notification", { error: err }));

        if (courseData?.hasCertificate && session.user.email) {
          const siteUrl = env.siteUrl;
          sendEmail({
            to: session.user.email,
            ...certificateEmail(
              session.user.name || "пользователь",
              courseData.title,
              `${siteUrl}/certificate/${courseData.id}`,
            ),
          }).catch((err: unknown) => log.error("Failed to send certificate email", { error: err }));
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
  } catch (error: unknown) {
    return handleApiError(error, { route: "courses/[id]/lessons/[lessonId] POST" });
  }
}
