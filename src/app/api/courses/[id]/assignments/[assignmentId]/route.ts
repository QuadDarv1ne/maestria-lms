import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("submission", RATE_LIMITS.user);

const submitAssignmentSchema = z.object({
  answer: z.string().min(1, "Ответ не может быть пустым"),
});

// POST: Submit an assignment answer
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; assignmentId: string } }
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

    const { id: courseId, assignmentId } = params;

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
    const validation = submitAssignmentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { answer } = validation.data;

    // Определяем статус в зависимости от типа задания
    let status = "submitted";
    if (assignment.type === "quiz") {
      // Для quiz проверяем правильность ответа
      try {
        const correctAnswer = assignment.correctAnswer;
        if (correctAnswer) {
          const userAnswer = JSON.parse(answer);
          const correctAnswerParsed = JSON.parse(correctAnswer);
          // Если все ответы совпадают - сразу ставим graded
          const isCorrect =
            Array.isArray(userAnswer) &&
            Array.isArray(correctAnswerParsed) &&
            userAnswer.length === correctAnswerParsed.length &&
            userAnswer.every((a: number, i: number) => a === correctAnswerParsed[i]);

          if (isCorrect) {
            status = "graded";
          }
        }
      } catch {
        // Если не удалось распарсить, оставляем submitted
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
        answer,
        status,
        maxScore: 100,
      },
      update: {
        answer,
        status,
        // Сбрасываем оценку при повторной отправке
        score: null,
        grade: null,
        feedback: null,
        gradedAt: null,
        gradedBy: null,
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
  { params }: { params: { id: string; assignmentId: string } }
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

    const { assignmentId } = params;

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
