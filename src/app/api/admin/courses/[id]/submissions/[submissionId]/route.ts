import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";

import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("grading", RATE_LIMITS.admin);

const gradeSubmissionSchema = z.object({
  score: z.number().min(0).max(100).optional(),
  grade: z.string().max(10).optional(),
  feedback: z.string().max(1000).optional(),
  status: z.enum(["graded", "failed"]).optional(),
});

// GET: Get a single submission for a course (teacher only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
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

    const userRole = session.user.role;
    if (userRole !== "admin" && userRole !== "teacher") {
      return NextResponse.json(
        { error: "Доступ запрещён. Требуются права преподавателя или администратора" },
        { status: 403 }
      );
    }

    const { id: courseId, submissionId } = await params;

    // Проверяем что курс принадлежит преподавателю или пользователь админ
    const course = await db.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Курс не найден" },
        { status: 404 }
      );
    }

    if (userRole !== "admin" && course.teacherId !== session.user.id) {
      return NextResponse.json(
        { error: "Доступ запрещён. Вы можете просматривать только свои курсы" },
        { status: 403 }
      );
    }

    const submission = await db.assignmentSubmission.findFirst({
      where: {
        id: submissionId,
        assignment: {
          lesson: {
            module: {
              courseId,
            },
          },
        },
      },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            type: true,
            points: true,
            lesson: {
              select: {
                id: true,
                title: true,
                module: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        grader: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Работа не найдена" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { submission },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/courses/[id]/submissions/[submissionId] GET" });
  }
}

// PUT: Grade a submission (teacher only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
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

    const userRole = session.user.role;
    if (userRole !== "admin" && userRole !== "teacher") {
      return NextResponse.json(
        { error: "Доступ запрещён. Требуются права преподавателя или администратора" },
        { status: 403 }
      );
    }

    const { id: courseId, submissionId } = await params;

    // Проверяем что курс принадлежит преподавателю
    const course = await db.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Курс не найден" },
        { status: 404 }
      );
    }

    if (userRole !== "admin" && course.teacherId !== session.user.id) {
      return NextResponse.json(
        { error: "Доступ запрещён. Вы можете оценивать только свои курсы" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = gradeSubmissionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { score, grade, feedback, status } = validation.data;

    // Проверяем что submission принадлежит этому курсу
    const submission = await db.assignmentSubmission.findFirst({
      where: {
        id: submissionId,
        assignment: {
          lesson: {
            module: {
              courseId,
            },
          },
        },
      },
      include: {
        assignment: {
          select: { title: true },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Работа не найдена" },
        { status: 404 }
      );
    }

    const updatedSubmission = await db.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        ...(score !== undefined && { score }),
        ...(grade !== undefined && { grade }),
        ...(feedback !== undefined && { feedback }),
        ...(status !== undefined && { status }),
        gradedAt: new Date(),
        gradedBy: session.user.id,
      },
      include: {
        assignment: {
          select: {
            title: true,
            type: true,
            points: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        grader: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Создаём уведомление для студента
    await db.notification.create({
      data: {
        userId: submission.userId,
        type: "completion",
        title: "Работа оценена",
        message: `Ваша работа "${submission.assignment.title}" получила оценку${score !== undefined ? ` ${score}/100` : ""}`,
        link: `/course/${courseId}`,
      },
    });

    return NextResponse.json(
      { message: "Работа оценена", submission: updatedSubmission },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/courses/[id]/submissions/[submissionId] PUT" });
  }
}
