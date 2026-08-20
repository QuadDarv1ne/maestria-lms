import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { validateParams, idOrSlugSchema, uuidSchema, validateBody } from "@/lib/request-validation";
import { resolveLessonAccess } from "../_access";
import { MAX_COMMENT_LENGTH } from "../_validation";

export const runtime = "nodejs";

const checkUpdateRateLimit = rateLimit("commentUpdate", RATE_LIMITS.commentCreate);

const updateCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Комментарий не может быть пустым")
    .max(MAX_COMMENT_LENGTH, `Комментарий слишком длинный (максимум ${MAX_COMMENT_LENGTH} символов)`),
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

// PATCH: Редактировать свой комментарий (или admin/teacher курса)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string; commentId: string }> },
) {
  const blocked = checkUpdateRateLimit(request);
  if (blocked) return blocked;
  try {
    const { id: courseId, lessonId, commentId } = await params;
    const paramCheck = validateParams(
      { id: courseId, lessonId, commentId },
      z.object({ id: idOrSlugSchema, lessonId: uuidSchema, commentId: uuidSchema }),
    );
    if ("response" in paramCheck) return paramCheck.response;

    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const access = await resolveLessonAccess(courseId, lessonId);
    if ("response" in access) return access.response;

    const comment = await db.lessonComment.findUnique({
      where: { id: commentId },
      include: {
        lesson: { select: { module: { select: { courseId: true } } } },
      },
    });

    if (!comment || comment.lessonId !== access.data.lessonId) {
      return NextResponse.json({ error: "Комментарий не найден" }, { status: 404 });
    }

    const isOwner = comment.userId === session.user.id;
    const isAdmin = session.user.role === "admin";
    const isCourseTeacher = (await db.course.findUnique({
      where: { id: comment.lesson.module.courseId },
      select: { teacherId: true },
    }))?.teacherId === session.user.id;

    if (!isOwner && !isAdmin && !isCourseTeacher) {
      return NextResponse.json(
        { error: "Вы можете редактировать только свои комментарии" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validation = validateBody(body, updateCommentSchema);
    if ("response" in validation) return validation.response;

    const updated = await db.lessonComment.update({
      where: { id: commentId },
      data: { content: validation.data.content, isEdited: true },
      select: commentSelect,
    });

    return NextResponse.json({ comment: updated });
  } catch (error: unknown) {
    return handleApiError(error, { route: "courses/[id]/lessons/[lessonId]/comments/[commentId] PATCH" });
  }
}

// DELETE: Удалить свой комментарий (или admin/teacher курса)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string; commentId: string }> },
) {
  const blocked = checkUpdateRateLimit(request);
  if (blocked) return blocked;
  try {
    const { id: courseId, lessonId, commentId } = await params;
    const paramCheck = validateParams(
      { id: courseId, lessonId, commentId },
      z.object({ id: idOrSlugSchema, lessonId: uuidSchema, commentId: uuidSchema }),
    );
    if ("response" in paramCheck) return paramCheck.response;

    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const access = await resolveLessonAccess(courseId, lessonId);
    if ("response" in access) return access.response;

    const comment = await db.lessonComment.findUnique({
      where: { id: commentId },
      include: {
        lesson: { select: { module: { select: { courseId: true } } } },
      },
    });

    if (!comment || comment.lessonId !== access.data.lessonId) {
      return NextResponse.json({ error: "Комментарий не найден" }, { status: 404 });
    }

    const isOwner = comment.userId === session.user.id;
    const isAdmin = session.user.role === "admin";
    const isCourseTeacher = (await db.course.findUnique({
      where: { id: comment.lesson.module.courseId },
      select: { teacherId: true },
    }))?.teacherId === session.user.id;

    if (!isOwner && !isAdmin && !isCourseTeacher) {
      return NextResponse.json(
        { error: "Вы можете удалить только свои комментарии" },
        { status: 403 },
      );
    }

    await db.lessonComment.delete({ where: { id: commentId } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "courses/[id]/lessons/[lessonId]/comments/[commentId] DELETE" });
  }
}
