import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { validateParams, idOrSlugSchema, uuidSchema } from "@/lib/request-validation";
import { resolveLessonManageAccess } from "@/lib/lesson-access";
import { deleteFileFromS3 } from "@/lib/file-upload";

export const runtime = "nodejs";

const checkDeleteRateLimit = rateLimit("attachmentDelete", RATE_LIMITS.default);

// DELETE: Удалить файл урока (только учитель курса или админ)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string; attachmentId: string }> },
) {
  const blocked = checkDeleteRateLimit(request);
  if (blocked) return blocked;
  try {
    const { id: courseId, lessonId, attachmentId } = await params;
    const paramCheck = validateParams(
      { id: courseId, lessonId, attachmentId },
      z.object({ id: idOrSlugSchema, lessonId: uuidSchema, attachmentId: uuidSchema }),
    );
    if ("response" in paramCheck) return paramCheck.response;

    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const access = await resolveLessonManageAccess(courseId, lessonId);
    if ("response" in access) return access.response;

    const attachment = await db.lessonAttachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, lessonId: true, key: true },
    });

    if (!attachment || attachment.lessonId !== access.data.lessonId) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    }

    // S3 deletion is best-effort: the DB record is authoritative for the UI
    try {
      await deleteFileFromS3(attachment.key);
    } catch (err: unknown) {
      log.error("Failed to delete attachment from S3", { key: attachment.key, error: err });
    }

    await db.lessonAttachment.delete({ where: { id: attachmentId } });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(error, { route: "courses/[id]/lessons/[lessonId]/attachments/[attachmentId] DELETE" });
  }
}
