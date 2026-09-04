import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { validateParams, idOrSlugSchema, uuidSchema } from "@/lib/request-validation";
import { z } from "zod";
import { gradeAssignment } from "@/lib/assignment-grading";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("submission", RATE_LIMITS.default);

// Base schema for all submissions - validate answer type and size
const baseSubmissionSchema = z.object({
  answer: z.union([
    z.string().max(10000),
    z.array(z.unknown()).max(100),
    z.record(z.string(), z.unknown()),
  ]),
});

// POST: Submit an assignment answer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const { id: courseId, assignmentId } = await params;
    const paramCheck = validateParams(
      { id: courseId, assignmentId },
      z.object({ id: idOrSlugSchema, assignmentId: uuidSchema }),
    );
    if ("response" in paramCheck) return paramCheck.response;

    // Resolve course ID (support both UUID and slug)
    const course = await db.course.findFirst({
      where: { OR: [{ id: courseId }, { slug: courseId }] },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Задание не найдено" },
        { status: 404 }
      );
    }

    const resolvedCourseId = course.id;

    // Проверяем что assignment существует и принадлежит курсу
    const assignment = await db.assignment.findFirst({
      where: {
        id: assignmentId,
        lesson: {
          module: {
            courseId: resolvedCourseId,
          },
        },
      },
      include: {
        lesson: {
          include: {
            module: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Задание не найдено" },
        { status: 404 }
      );
    }

    // Проверяем что пользователь записан на курс
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: resolvedCourseId,
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "Вы не записаны на этот курс" },
        { status: 403 }
      );
    }

    // Проверяем лимит попыток
    if (assignment.maxAttempts > 0) {
      const attemptCount = await db.assignmentSubmission.count({
        where: {
          assignmentId,
          userId: session.user.id,
        },
      });

      if (attemptCount >= assignment.maxAttempts) {
        return NextResponse.json(
          {
            error: `Превышен лимит попыток для этого задания (максимум ${assignment.maxAttempts})`,
            code: "attempt_limit_exceeded",
            maxAttempts: assignment.maxAttempts,
            attemptCount,
          },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const validation = baseSubmissionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { answer } = validation.data;
    const answerStr = typeof answer === "string" ? answer : JSON.stringify(answer);

    // Определяем статус и score в зависимости от типа задания
    const { status, score } = gradeAssignment(assignment.type, answer, assignment.correctAnswer);

    // Создаём новую запись (каждая попытка — отдельный row)
    const submission = await db.assignmentSubmission.create({
      data: {
        assignmentId,
        userId: session.user.id,
        answer: answerStr,
        status,
        score,
        maxScore: 100,
      },
    });

    return NextResponse.json(
      { message: "Ответ сохранён", submission },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "courses/[id]/assignments/[assignmentId]/submit POST" });
  }
}

// GET: Get submission status for current user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const { id: courseId, assignmentId } = await params;
    const paramCheck = validateParams(
      { id: courseId, assignmentId },
      z.object({ id: idOrSlugSchema, assignmentId: uuidSchema }),
    );
    if ("response" in paramCheck) return paramCheck.response;

    // Resolve course ID (support both UUID and slug)
    const course = await db.course.findFirst({
      where: { OR: [{ id: courseId }, { slug: courseId }] },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Задание не найдено" },
        { status: 404 }
      );
    }

    const resolvedCourseId = course.id;

    // Проверяем что assignment существует и принадлежит курсу
    const assignment = await db.assignment.findFirst({
      where: {
        id: assignmentId,
        lesson: {
          module: {
            courseId: resolvedCourseId,
          },
        },
      },
      select: {
        id: true,
        maxAttempts: true,
        points: true,
        title: true,
        type: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Задание не найдено" },
        { status: 404 }
      );
    }

    // Проверяем что пользователь записан на курс
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: resolvedCourseId,
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "Вы не записаны на этот курс" },
        { status: 403 }
      );
    }

    // Получаем информацию о попытках
    const attemptCount = await db.assignmentSubmission.count({
      where: {
        assignmentId,
        userId: session.user.id,
      },
    });

    const submission = await db.assignmentSubmission.findFirst({
      where: {
        assignmentId,
        userId: session.user.id,
      },
      orderBy: { submittedAt: "desc" },
    });

    if (!submission) {
      return NextResponse.json(
        {
          submission: null,
          attemptCount: 0,
          maxAttempts: assignment.maxAttempts,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        submission,
        attemptCount,
        maxAttempts: assignment.maxAttempts,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "courses/[id]/assignments/[assignmentId] GET" });
  }
}
