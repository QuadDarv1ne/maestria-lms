import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { ExtendedSession } from "@/lib/auth";
import { s3Client, S3_BUCKET, toCdnUrl, makeFileKey } from "@/lib/s3";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

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
  const session = (await getServerSession(authOptions)) as ExtendedSession | null;
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "admin";
  const isTeacher = session.user.role === "teacher";
  if (!isAdmin && !isTeacher) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "uploads";

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
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки файла" },
      { status: 500 }
    );
  }
}
