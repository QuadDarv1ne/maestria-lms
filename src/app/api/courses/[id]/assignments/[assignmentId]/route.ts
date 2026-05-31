import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { z } from "zod";
import { log } from "@/lib/logger";

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
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const { id: courseId, assignmentId } = await params;

    // Проверяем что assignment существует и принадлежит курсу
    const assignment = await db.assignment.findFirst({
      where: {
        id: assignmentId,
        lesson: {
          module: {
            courseId,
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
          courseId,
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
    let status: string = "submitted";
    let score: number | null = null;

    if (assignment.type === "quiz") {
      // Для quiz проверяем правильность ответа
      try {
        const correctAnswer = assignment.correctAnswer;
        if (correctAnswer) {
          const userAnswer = typeof answer === "string" ? JSON.parse(answer) : answer;
          const correctAnswerParsed = JSON.parse(correctAnswer);
          
          if (typeof correctAnswerParsed === "number") {
            const userSingleAnswer = Array.isArray(userAnswer) ? userAnswer[0] : userAnswer;
            status = "graded";
            score = userSingleAnswer === correctAnswerParsed ? 100 : 0;
          } else if (Array.isArray(correctAnswerParsed) && Array.isArray(userAnswer)) {
            const correctSet = new Set(correctAnswerParsed);
            const userSet = new Set(userAnswer);

            const exactMatch = userSet.size === correctSet.size && [...userSet].every(a => correctSet.has(a));

            if (exactMatch) {
              status = "graded";
              score = 100;
            } else if (correctSet.size > 0) {
              const correctCount = [...userSet].filter(a => correctSet.has(a)).length;
              const wrongCount = userSet.size - correctCount;
              score = Math.max(0, Math.round(((correctCount - wrongCount) / correctSet.size) * 100));
              status = "graded";
            }
          }
        }
      } catch {
        log.warn("Failed to parse assignment answer for grading", { assignmentId: assignment.id, type: assignment.type });
      }
    } else if (assignment.type === "matching") {
      // Auto-grading для matching
      try {
        const correctAnswer = assignment.correctAnswer;
        if (correctAnswer) {
          const userAnswer = typeof answer === "string" ? JSON.parse(answer) : answer;
          const correctParsed = JSON.parse(correctAnswer);
          
          // Сравниваем пары
          if (Array.isArray(userAnswer) && Array.isArray(correctParsed)) {
            const isCorrect = userAnswer.every(
              (pair: { left: string; right: string }, idx: number) =>
                pair.left === correctParsed[idx]?.left && pair.right === correctParsed[idx]?.right
            );
            if (isCorrect) {
              status = "graded";
              score = 100;
            } else {
              const correctCount = userAnswer.filter(
                (pair: { left: string; right: string }, idx: number) =>
                  pair.left === correctParsed[idx]?.left && pair.right === correctParsed[idx]?.right
              ).length;
              score = Math.round((correctCount / correctParsed.length) * 100);
              status = "graded";
            }
          }
        }
      } catch {
        log.warn("Failed to parse assignment answer for grading", { assignmentId: assignment.id, type: assignment.type });
      }
    } else if (assignment.type === "ordering") {
      // Auto-grading для ordering
      try {
        const correctAnswer = assignment.correctAnswer;
        if (correctAnswer) {
          const userAnswer = typeof answer === "string" ? JSON.parse(answer) : answer;
          const correctParsed = JSON.parse(correctAnswer);
          
          // Сравниваем порядок
          if (Array.isArray(userAnswer) && Array.isArray(correctParsed)) {
            const isCorrect = userAnswer.every(
              (item: string, idx: number) => item === correctParsed[idx]
            );
            if (isCorrect) {
              status = "graded";
              score = 100;
            } else {
              // Partial credit за правильные позиции
              const correctCount = userAnswer.filter(
                (item: string, idx: number) => item === correctParsed[idx]
              ).length;
              score = Math.round((correctCount / correctParsed.length) * 100);
              status = "graded";
            }
          }
        }
      } catch {
        log.warn("Failed to parse assignment answer for grading", { assignmentId: assignment.id, type: assignment.type });
      }
    }

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
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const { assignmentId } = await params;

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
      include: {
        assignment: {
          select: {
            title: true,
            type: true,
            points: true,
            maxAttempts: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        {
          submission: null,
          attemptCount,
          maxAttempts: 0,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        submission,
        attemptCount,
        maxAttempts: submission.assignment.maxAttempts,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "courses/[id]/assignments/[assignmentId] GET" });
  }
}
