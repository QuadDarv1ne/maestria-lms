import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { validateParams, idOrSlugSchema, uuidSchema, validateBody, paginationSchema } from "@/lib/request-validation";
import { resolveLessonAccess } from "./_access";
import { MAX_COMMENT_LENGTH } from "./_validation";

export const runtime = "nodejs";

const checkGetRateLimit = rateLimit("commentRead", RATE_LIMITS.default);
const checkCreateRateLimit = rateLimit("commentCreate", RATE_LIMITS.commentCreate);

const commentBodySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Комментарий не может быть пустым")
    .max(MAX_COMMENT_LENGTH, `Комментарий слишком длинный (максимум ${MAX_COMMENT_LENGTH} символов)`),
  parentId: z.string().uuid("Некорректный формат parentId").optional().nullable(),
});

const commentSelect = {
  id: true,
  content: true,
  isEdited: true,
  createdAt: true,
  updatedAt: true,
  parentId: true,
  user: {
    select: {
      id: true,
      name: true,
      image: true,
      role: true,
    },
  },
} as const;

// GET: Список комментариев к уроку (плоский список, группировка по parentId на клиенте)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> },
) {
  const blocked = checkGetRateLimit(request);
  if (blocked) return blocked;
  try {
    const { id: courseId, lessonId } = await params;
    const paramCheck = validateParams(
      { id: courseId, lessonId },
      z.object({ id: idOrSlugSchema, lessonId: uuidSchema }),
    );
    if ("response" in paramCheck) return paramCheck.response;

    const access = await resolveLessonAccess(courseId, lessonId);
    if ("response" in access) return access.response;

    const { searchParams } = new URL(request.url);
    const query = validateParams(
      Object.fromEntries(searchParams),
      paginationSchema,
    );
    if ("response" in query) return query.response;
    const { page, limit } = query.data;
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      db.lessonComment.findMany({
        where: { lessonId: access.data.lessonId },
        select: commentSelect,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.lessonComment.count({ where: { lessonId: access.data.lessonId } }),
    ]);

    return NextResponse.json({
      comments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "courses/[id]/lessons/[lessonId]/comments GET" });
  }
}

// POST: Создать комментарий (только для записанных пользователей или бесплатных уроков)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> },
) {
  const blocked = checkCreateRateLimit(request);
  if (blocked) return blocked;
  try {
    const { id: courseId, lessonId } = await params;
    const paramCheck = validateParams(
      { id: courseId, lessonId },
      z.object({ id: idOrSlugSchema, lessonId: uuidSchema }),
    );
    if ("response" in paramCheck) return paramCheck.response;

    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();
    const userId = session.user.id;

    const access = await resolveLessonAccess(courseId, lessonId);
    if ("response" in access) return access.response;

    const body = await request.json();
    const validation = validateBody(body, commentBodySchema);
    if ("response" in validation) return validation.response;

    const { content, parentId } = validation.data;

    // Parent comment (if any) must belong to the same lesson
    if (parentId) {
      const parent = await db.lessonComment.findUnique({
        where: { id: parentId },
        select: { lessonId: true, userId: true, parentId: true },
      });
      if (!parent || parent.lessonId !== access.data.lessonId) {
        return NextResponse.json(
          { error: "Ответ можно оставить только под комментарием этого урока" },
          { status: 400 },
        );
      }
      if (parent.parentId) {
        return NextResponse.json(
          { error: "Нельзя отвечать на ответ — выберите верхний комментарий" },
          { status: 400 },
        );
      }
    }

    const comment = await db.lessonComment.create({
      data: {
        lessonId: access.data.lessonId,
        userId,
        content,
        parentId: parentId ?? null,
      },
      select: commentSelect,
    });

    // Notify the course teacher about a new comment (fire-and-forget)
    if (!parentId) {
      const course = await db.course.findUnique({
        where: { id: access.data.courseId },
        select: { title: true, teacherId: true },
      });
      if (course?.teacherId && course.teacherId !== userId) {
        createNotification({
          userId: course.teacherId,
          type: "comment",
          title: "Новый комментарий",
          message: `Новый комментарий в курсе "${course.title}"`,
          link: `/course/${access.data.courseId}/lesson/${access.data.lessonId}`,
        }).catch((err: unknown) =>
          log.error("Failed to send comment notification", { error: err }),
        );
      }
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "courses/[id]/lessons/[lessonId]/comments POST" });
  }
}
