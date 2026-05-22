import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { pushUnreadCount } from "@/lib/sse";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Необходимо авторизоваться" }, { status: 401 });
  }

  try {
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
    const updated = await db.notification.update({
      where: { id },
      data: { read: body.read ?? true },
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
  } catch (error) {
    console.error("Ошибка обновления уведомления:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Необходимо авторизоваться" }, { status: 401 });
  }

  try {
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
  } catch (error) {
    console.error("Ошибка удаления уведомления:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
