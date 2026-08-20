import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { validateParams, idOrSlugSchema, uuidSchema } from "@/lib/request-validation";
import { resolveLessonAccess, resolveLessonManageAccess } from "@/lib/lesson-access";
import { uploadFileToS3, UploadError } from "@/lib/file-upload";

export const runtime = "nodejs";

const checkReadRateLimit = rateLimit("attachmentRead", RATE_LIMITS.default);
const checkUploadRateLimit = rateLimit("attachmentUpload", RATE_LIMITS.attachmentUpload);

const attachmentSelect = {
  id: true,
  name: true,
  key: true,
  url: true,
  size: true,
  type: true,
  createdAt: true,
  addedBy: { select: { id: true, name: true } },
} as const;

// GET: Список файлов урока (доступ — запись на курс / бесплатный урок / учитель / админ)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> },
) {
  const blocked = checkReadRateLimit(request);
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

    const session = await getAuthSession();
    const canManage = !!session?.user && (
      session.user.role === "admin" || access.data.courseTeacherId === session.user.id
    );

    const attachments = await db.lessonAttachment.findMany({
      where: { lessonId: access.data.lessonId },
      select: attachmentSelect,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ attachments, canManage });
  } catch (error: unknown) {
    return handleApiError(error, { route: "courses/[id]/lessons/[lessonId]/attachments GET" });
  }
}

// POST: Загрузить файл урока (только учитель курса или админ)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> },
) {
  const blocked = checkUploadRateLimit(request);
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

    const access = await resolveLessonManageAccess(courseId, lessonId);
    if ("response" in access) return access.response;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
    }

    const { key, url, size, type } = await uploadFileToS3(
      `attachments/${access.data.lessonId}`,
      file,
    );

    const attachment = await db.lessonAttachment.create({
      data: {
        lessonId: access.data.lessonId,
        name: file.name,
        key,
        url,
        size,
        type,
        addedById: session.user.id,
      },
      select: attachmentSelect,
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleApiError(error, { route: "courses/[id]/lessons/[lessonId]/attachments POST" });
  }
}
