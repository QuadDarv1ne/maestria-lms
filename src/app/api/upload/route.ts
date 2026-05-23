import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getAuthSession } from "@/lib/auth";
import { s3Client, S3_BUCKET, toCdnUrl, makeFileKey, isS3Available } from "@/lib/s3";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/pdf",
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const checkRateLimit = rateLimit("upload", RATE_LIMITS.upload);

export async function POST(req: NextRequest) {
  const blocked = checkRateLimit(req);
  if (blocked) return blocked;
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Необходимо авторизоваться" }, { status: 401 });
  }

  const isAdmin = session.user.role === "admin";
  const isTeacher = session.user.role === "teacher";
  if (!isAdmin && !isTeacher) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  if (!isS3Available()) {
    return NextResponse.json(
      { error: "Хранилище не настроено — обратитесь к администратору" },
      { status: 503 }
    );
  }

  if (!s3Client) {
    return NextResponse.json(
      { error: "S3 клиент не инициализирован" },
      { status: 500 }
    );
  }

  try {
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

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Файл слишком большой (макс. 100 МБ)" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Тип ${file.type} не поддерживается` },
        { status: 400 }
      );
    }

    const key = makeFileKey(folder, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    return NextResponse.json({
      key,
      url: toCdnUrl(key),
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    return handleApiError(error, { route: "upload" });
  }
}
