import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-errors";
import { z } from "zod";

export const runtime = "nodejs";

const publishSchema = z.object({
  userId: z.string().min(1, "userId обязателен"),
  type: z.enum(["enrollment", "completion", "achievement", "review", "payment", "system"]),
  title: z.string().min(1, "title обязателен"),
  message: z.string().min(1, "message обязателен"),
  link: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Необходимо авторизоваться" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validation = publishSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const input = validation.data;

    // Только админы могут отправлять уведомления другим пользователям
    if (input.userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Нет прав для отправки уведомлений другим пользователям" },
        { status: 403 }
      );
    }

    const notification = await createNotification(input);

    return NextResponse.json({ ok: true, notification });
  } catch (error) {
    return handleApiError(error, { route: "notifications/publish" });
  }
}
