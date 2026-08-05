import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { validateParams, idOrSlugSchema } from "@/lib/request-validation";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("progress", RATE_LIMITS.progress);

const patchProgressSchema = z.object({
  lessonId: z.string().uuid(),
  completed: z.boolean().optional(),
  score: z.number().int().min(0).max(100).optional().nullable(),
  timeSpent: z.number().int().min(0).optional(),
});

// GET /api/courses/[id]/progress — Get full progress overview for a course
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const { id: courseId } = await params;
    const paramCheck = validateParams({ id: courseId }, z.object({ id: idOrSlugSchema }));
    if ("response" in paramCheck) return paramCheck.response;

    const session = await getAuthSession();
    if (!requireAuth(session)) {
      return authErrorResponse();
    }

    const userId = session.user.id;

    // Resolve course ID (support both UUID and slug)
    const course = await db.course.findFirst({
      where: { OR: [{ id: courseId }, { slug: courseId }] },
      select: { id: true, title: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Курс не найден" },
        { status: 404 }
      );
    }

    const resolvedCourseId = course.id;

    // Verify enrollment
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId: resolvedCourseId },
      },
      select: { id: true, status: true, progress: true },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "Вы не записаны на этот курс" },
        { status: 403 }
      );
    }

    // Get course structure (modules + lessons)
    const courseWithModules = await db.course.findUnique({
      where: { id: resolvedCourseId },
      include: {
        modules: {
          include: {
            lessons: {
              select: {
                id: true,
                title: true,
                sortOrder: true,
                type: true,
              },
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!courseWithModules) {
      return NextResponse.json(
        { error: "Курс не найден" },
        { status: 404 }
      );
    }

    // Get all progress records for this user in this course
    const allLessonIds = courseWithModules.modules.flatMap((m) =>
      m.lessons.map((l) => l.id)
    );

    const progressRecords = await db.progress.findMany({
      where: {
        userId,
        lessonId: { in: allLessonIds },
      },
      select: {
        lessonId: true,
        completed: true,
        score: true,
        timeSpent: true,
        lastAccessed: true,
      },
    });

    // Build progress map
    const progressMap = new Map(
      progressRecords.map((p) => [p.lessonId, p])
    );

    // Calculate overall stats
    const totalLessons = allLessonIds.length;
    const completedLessons = progressRecords.filter((p) => p.completed).length;
    const totalTimeSpent = progressRecords.reduce(
      (sum, p) => sum + p.timeSpent,
      0
    );
    const courseProgress =
      totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0;

    // Build module-level progress
    const modulesWithProgress = courseWithModules.modules.map((module) => {
      const moduleLessons = module.lessons.length;
      const moduleCompleted = module.lessons.filter((l) => {
        const p = progressMap.get(l.id);
        return p?.completed;
      }).length;
      const moduleTimeSpent = module.lessons.reduce((sum, l) => {
        const p = progressMap.get(l.id);
        return sum + (p?.timeSpent || 0);
      }, 0);

      return {
        id: module.id,
        title: module.title,
        sortOrder: module.sortOrder,
        totalLessons: moduleLessons,
        completedLessons: moduleCompleted,
        progress:
          moduleLessons > 0
            ? Math.round((moduleCompleted / moduleLessons) * 100)
            : 0,
        timeSpent: moduleTimeSpent,
        lessons: module.lessons.map((lesson) => {
          const p = progressMap.get(lesson.id);
          return {
            id: lesson.id,
            title: lesson.title,
            sortOrder: lesson.sortOrder,
            type: lesson.type,
            completed: p?.completed || false,
            score: p?.score ?? null,
            timeSpent: p?.timeSpent || 0,
            lastAccessed: p?.lastAccessed?.toISOString() || null,
          };
        }),
      };
    });

    // Calculate streak info (consecutive days with progress, UTC-based)
    const utcDateKey = (d: Date): string => d.toISOString().split("T")[0];

    const activeDays = new Set(
      progressRecords
        .filter((p): p is typeof p & { lastAccessed: Date } => p.lastAccessed !== null)
        .map((p) => utcDateKey(p.lastAccessed)),
    );

    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    let currentStreak = 0;
    const cursor = new Date(todayUtc);
    // Streak may start today or yesterday; otherwise it is broken.
    if (!activeDays.has(utcDateKey(cursor))) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    if (activeDays.has(utcDateKey(cursor))) {
      currentStreak = 1;
      for (;;) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        if (activeDays.has(utcDateKey(cursor))) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    return NextResponse.json({
      courseId: resolvedCourseId,
      courseTitle: courseWithModules.title,
      enrollmentStatus: enrollment.status,
      enrollmentProgress: enrollment.progress,
      overall: {
        totalLessons,
        completedLessons,
        courseProgress,
        totalTimeSpent,
        currentStreak,
      },
      modules: modulesWithProgress,
    });
  } catch (error: unknown) {
    return handleApiError(error, { context: "GET /api/courses/[id]/progress" });
  }
}

// PATCH /api/courses/[id]/progress — Update progress for a specific lesson
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const { id: courseId } = await params;
    const paramCheck = validateParams({ id: courseId }, z.object({ id: idOrSlugSchema }));
    if ("response" in paramCheck) return paramCheck.response;

    const session = await getAuthSession();
    if (!requireAuth(session)) {
      return authErrorResponse();
    }

    const userId = session.user.id;

    // Resolve course ID (support both UUID and slug)
    const course = await db.course.findFirst({
      where: { OR: [{ id: courseId }, { slug: courseId }] },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Курс не найден" },
        { status: 404 }
      );
    }

    const resolvedCourseId = course.id;

    // Verify enrollment
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId: resolvedCourseId },
      },
      select: { id: true, status: true },
    });

    if (!enrollment || enrollment.status !== "active") {
      return NextResponse.json(
        { error: "Необходима активная запись на курс" },
        { status: 403 }
      );
    }

    // Validate body
    const body = await request.json();
    const parsed = patchProgressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Ошибка валидации",
          details: parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { lessonId, completed, score, timeSpent } = parsed.data;

    // Verify lesson belongs to this course
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        module: {
          select: { courseId: true },
        },
      },
    });

    if (!lesson || lesson.module.courseId !== resolvedCourseId) {
      return NextResponse.json(
        { error: "Урок не найден в этом курсе" },
        { status: 404 }
      );
    }

    // Upsert progress
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
        ...(completed !== undefined && { completed }),
        ...(score !== undefined && { score }),
        ...(timeSpent !== undefined && {
          timeSpent: { increment: timeSpent },
        }),
        lastAccessed: new Date(),
      },
    });

    // Recalculate course-level progress
    const allLessonIds = (
      await db.lesson.findMany({
        where: { module: { courseId: resolvedCourseId } },
        select: { id: true },
      })
    ).map((l) => l.id);

    const completedCount = await db.progress.count({
      where: {
        userId,
        lessonId: { in: allLessonIds },
        completed: true,
      },
    });

    const courseProgress =
      allLessonIds.length > 0
        ? Math.round((completedCount / allLessonIds.length) * 100)
        : 0;

    // Update enrollment progress
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: {
        progress: courseProgress,
        ...(courseProgress === 100 && { completedAt: new Date() }),
      },
    });

    return NextResponse.json({
      progress: {
        id: progress.id,
        lessonId: progress.lessonId,
        completed: progress.completed,
        score: progress.score,
        timeSpent: progress.timeSpent,
        lastAccessed: progress.lastAccessed.toISOString(),
      },
      courseProgress,
      courseCompleted: courseProgress === 100,
    });
  } catch (error: unknown) {
    return handleApiError(error, {
      context: "PATCH /api/courses/[id]/progress",
    });
  }
}