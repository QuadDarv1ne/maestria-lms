import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { parsePagination } from "@/lib/utils";
import { validateParams, idOrSlugSchema } from "@/lib/request-validation";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("grading", RATE_LIMITS.admin);

const submissionsQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  assignmentId: z.string().uuid().optional(),
});

// GET: Get all submissions for a course (teacher only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const userRole = session.user.role;
    if (userRole !== "admin" && userRole !== "teacher") {
      return NextResponse.json(
        { error: "Доступ запрещён. Требуются права преподавателя или администратора" },
        { status: 403 }
      );
    }

    const { id: courseId } = await params;
    const paramCheck = validateParams({ id: courseId }, z.object({ id: idOrSlugSchema }));
    if ("response" in paramCheck) return paramCheck.response;

    // Resolve course ID (support both UUID and slug)
    const course = await db.course.findFirst({
      where: { OR: [{ id: courseId }, { slug: courseId }] },
      select: { id: true, teacherId: true },
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

    const resolvedCourseId = course.id;

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams, { defaultLimit: 20, maxLimit: 100 });
    const queryParsed = submissionsQuerySchema.safeParse({
      status: searchParams.get("status"),
      assignmentId: searchParams.get("assignmentId"),
    });
    const { status, assignmentId } = queryParsed.success ? queryParsed.data : { status: undefined, assignmentId: undefined };

    const where = {
      assignment: {
        lesson: {
          module: {
            courseId: resolvedCourseId,
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
