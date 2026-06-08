import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { pushUnreadCount } from "@/lib/sse";
import { handleApiError } from "@/lib/api-errors";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("notification", RATE_LIMITS.default);

const notificationPatchSchema = z.object({
  read: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const blocked = checkRateLimit(request);
    if (blocked) return blocked;

    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Необходимо авторизоваться" }, { status: 401 });
    }

    const { id } = await params;

    const notification = await db.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Уведомление не найдено" },
        { status: 404 }
      );
    }

    if (notification.userId !== session.user.id) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const validation = notificationPatchSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const updated = await db.notification.update({
      where: { id },
      data: { read: validation.data.read ?? true },
    });

    const unreadCount = await db.notification.count({
      where: { userId: session.user.id, read: false },
    });
    pushUnreadCount(session.user.id, unreadCount);

    return NextResponse.json({
      notification: {
        id: updated.id,
        type: updated.type,
        title: updated.title,
        message: updated.message,
        read: updated.read,
        createdAt: updated.createdAt.getTime(),
        link: updated.link ?? undefined,
      },
      unreadCount,
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "notifications/[id] PATCH" });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const blocked = checkRateLimit(request);
    if (blocked) return blocked;

    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Необходимо авторизоваться" }, { status: 401 });
    }

    const { id } = await params;

    const notification = await db.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Уведомление не найдено" },
        { status: 404 }
      );
    }

    if (notification.userId !== session.user.id) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    await db.notification.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(error, { route: "notifications/[id] DELETE" });
  }
}
