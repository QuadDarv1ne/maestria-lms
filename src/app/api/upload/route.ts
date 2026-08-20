import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { uploadFileToS3, UploadError } from "@/lib/file-upload";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("upload", RATE_LIMITS.upload);

export async function POST(req: NextRequest) {
  try {
    const blocked = checkRateLimit(req);
    if (blocked) return blocked;
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    // Разрешаем загрузку всем авторизованным пользователям (студентам — для file_upload заданий)
    const allowedRoles = ["admin", "teacher", "student"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Доступ запрещён. Доступно для администраторов, преподавателей и студентов" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawFolder = (formData.get("folder") as string) || "uploads";

    // Validate folder to prevent path traversal
    const folderRegex = /^[a-zA-Z0-9_-]+$/;
    if (!folderRegex.test(rawFolder)) {
      return NextResponse.json(
        { error: "Недопустимое имя папки" },
        { status: 400 }
      );
    }
    const folder = rawFolder;

    if (!file) {
      return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
    }

    const result = await uploadFileToS3(folder, file);

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleApiError(error, { route: "upload" });
  }
}
