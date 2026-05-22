import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("submission", RATE_LIMITS.user);

// Base schema for all submissions
const baseSubmissionSchema = z.object({
  answer: z.union([z.string(), z.array(z.any()), z.record(z.any())]),
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
          
          // Если все ответы совпадают - сразу ставим graded
          const isCorrect =
            Array.isArray(userAnswer) &&
            Array.isArray(correctAnswerParsed) &&
            userAnswer.length === correctAnswerParsed.length &&
            userAnswer.every((a: number, i: number) => a === correctAnswerParsed[i]);

          if (isCorrect) {
            status = "graded";
            score = 100;
          } else {
            // Частичный score за частичные ответы
            const correctCount = userAnswer.filter((a: number) => correctAnswerParsed.includes(a)).length;
            score = Math.round((correctCount / correctAnswerParsed.length) * 100);
            status = "graded";
          }
        }
      } catch {
        // Если не удалось распарсить, оставляем submitted
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
        // Оставляем submitted
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
        // Оставляем submitted
      }
    }

    // Создаём или обновляем submission
    const submission = await db.assignmentSubmission.upsert({
      where: {
        assignmentId_userId: {
          assignmentId,
          userId: session.user.id,
        },
      },
      create: {
        assignmentId,
        userId: session.user.id,
        answer: answerStr,
        status,
        score,
        maxScore: 100,
      },
      update: {
        answer: answerStr,
        status,
        ...(score !== null && { score }),
        // Сбрасываем оценку при повторной отправке если статус не graded
        ...(status !== "graded" && {
          score: null,
          grade: null,
          feedback: null,
          gradedAt: null,
          gradedBy: null,
        }),
      },
    });

    return NextResponse.json(
      { message: "Ответ сохранён", submission },
      { status: 200 }
    );
  } catch (error) {
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

    const submission = await db.assignmentSubmission.findUnique({
      where: {
        assignmentId_userId: {
          assignmentId,
          userId: session.user.id,
        },
      },
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
        { submission: null },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { submission },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, { route: "courses/[id]/assignments/[assignmentId] GET" });
  }
}
