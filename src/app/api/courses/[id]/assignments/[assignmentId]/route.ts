import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { validateParams, idOrSlugSchema, uuidSchema } from "@/lib/request-validation";
import { z } from "zod";
import { gradeAssignment } from "@/lib/assignment-grading";
import { createSubmissionWithinAttemptLimit } from "@/lib/assignment-submission";

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
      select: { status: true },
    });

    // `cancelled` must not pass. The check used to be `if (!enrollment)`, so a
    // student whose enrollment was cancelled (refund, admin action) kept
    // submitting work for a course they no longer had access to — every other
    // route in the app checks `status === "active"`.
    if (!enrollment || enrollment.status !== "active") {
      return NextResponse.json(
        { error: "Необходима активная запись на курс", code: "enrollment_required" },
        { status: 403 }
      );
    }

    // The countdown used to live only in StepAssignment, so reloading the page
    // reset it and a direct POST had no clock at all. The server now measures
    // from the earliest recorded activity — the first submission or the last
    // access to the lesson — and refuses anything past the deadline.
    //
    // Known gap: a student who has never interacted has no anchor, so the first
    // attempt is still unbounded. Closing that properly needs a "started" row
    // (per user+assignment) rather than a new column on an existing table.
    if (assignment.timeLimit && assignment.timeLimit > 0) {
      const [firstAttempt, lessonAccess] = await Promise.all([
        db.assignmentSubmission.findFirst({
          where: { assignmentId, userId: session.user.id },
          orderBy: { submittedAt: "asc" },
          select: { submittedAt: true },
        }),
        db.progress.findUnique({
          where: { userId_lessonId: { userId: session.user.id, lessonId: assignment.lesson.id } },
          select: { lastAccessed: true },
        }),
      ]);

      const anchors = [firstAttempt?.submittedAt, lessonAccess?.lastAccessed]
        .filter((d): d is Date => d instanceof Date);
      const startedAt = anchors.length > 0
        ? new Date(Math.min(...anchors.map((d) => d.getTime())))
        : null;

      if (startedAt) {
        const deadline = startedAt.getTime() + assignment.timeLimit * 60_000;
        if (Date.now() > deadline) {
          return NextResponse.json(
            {
              error: `Время на выполнение задания истекло (${assignment.timeLimit} мин)`,
              code: "time_limit_exceeded",
              timeLimit: assignment.timeLimit,
            },
            { status: 403 }
          );
        }
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

    // The attempt limit used to be a plain count-then-create: two parallel
    // POSTs both read "1 of 3" and both inserted, so a student could submit any
    // number of times by firing the requests together. The check and the insert
    // now share a Serializable transaction, which makes the second transaction
    // fail to serialise instead of silently exceeding the limit.
    const outcome = await createSubmissionWithinAttemptLimit({
      assignmentId,
      userId: session.user.id,
      maxAttempts: assignment.maxAttempts,
      data: { answer: answerStr, status, score },
    });

    if ("limitExceeded" in outcome) {
      return NextResponse.json(
        {
          error: `Превышен лимит попыток для этого задания (максимум ${assignment.maxAttempts})`,
          code: "attempt_limit_exceeded",
          maxAttempts: assignment.maxAttempts,
          attemptCount: outcome.attemptCount,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { message: "Ответ сохранён", submission: outcome.submission },
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
      select: { status: true },
    });

    // Same rule as POST: a cancelled enrollment has no access to the work.
    if (!enrollment || enrollment.status !== "active") {
      return NextResponse.json(
        { error: "Необходима активная запись на курс", code: "enrollment_required" },
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
