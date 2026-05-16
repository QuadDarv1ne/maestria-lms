import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const updateProgressSchema = z.object({
  completed: z.boolean().optional(),
  score: z.number().int().min(0).max(100).optional().nullable(),
  timeSpent: z.number().int().min(0).optional(),
});

// GET: Получить содержимое шага (урока) с полной навигацией по курсу
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
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

    if (!lesson || lesson.module.courseId !== courseId) {
      return NextResponse.json(
        { error: "Шаг не найден" },
        { status: 404 }
      );
    }

    // Проверяем доступ
    let isEnrolled = false;
    let progressData = null;
    let sessionUser = null;

    const session = await getServerSession(authOptions);
    if (session?.user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sessionUser = session.user as any;
      const enrollment = await db.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: sessionUser.id,
            courseId,
          },
        },
      });
      isEnrolled = !!enrollment && enrollment.status === "active";

      // Получаем прогресс по этому уроку
      progressData = await db.progress.findUnique({
        where: {
          userId_lessonId: {
            userId: sessionUser.id,
            lessonId,
          },
        },
      });
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

    return NextResponse.json({
      lesson: {
        ...lesson,
        completed: completedLessonIds.includes(lessonId),
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
    console.error("Ошибка получения шага:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

// POST: Отправить прогресс / отметить шаг как пройденный
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const { id: courseId, lessonId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "Ошибка аутентификации" }, { status: 401 });
    }
    // Проверяем запись на курс или бесплатность урока
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true } } },
    });

    if (!lesson || lesson.module.courseId !== courseId) {
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
        await db.enrollment.update({
          where: { id: enrollment.id },
          data: {
            progress: courseProgress,
            completedAt: courseProgress === 100 ? new Date() : undefined,
            status: courseProgress === 100 ? "completed" : "active",
          },
        });
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
    console.error("Ошибка обновления прогресса:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
