import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { parsePagination } from "@/lib/utils";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("grading", RATE_LIMITS.admin);

// GET: Get all submissions for a course (teacher only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: courseId } = await params;

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

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams, { defaultLimit: 20, maxLimit: 100 });
    const status = searchParams.get("status");
    const assignmentId = searchParams.get("assignmentId");

    const where = {
      assignment: {
        lesson: {
          module: {
            courseId,
          },
        },
      },
      ...(status && { status }),
      ...(assignmentId && { assignmentId }),
    };

    const [submissions, total] = await Promise.all([
      db.assignmentSubmission.findMany({
        where,
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
        orderBy: { submittedAt: "desc" },
        skip,
        take: limit,
      }),
      db.assignmentSubmission.count({ where }),
    ]);

    return NextResponse.json(
      {
        submissions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/courses/[id]/submissions GET" });
  }
}
