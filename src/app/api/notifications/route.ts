import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, type ExtendedSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("notifications", RATE_LIMITS.default);

export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const session = await getAuthSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  try {
    const authSession = session as ExtendedSession;
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const offset = Number(url.searchParams.get("offset")) || 0;

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: authSession.user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.notification.count({ where: { userId: authSession.user.id } }),
      db.notification.count({
        where: { userId: authSession.user.id, read: false },
      }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt.getTime(),
        link: n.link ?? undefined,
      })),
      total,
      unreadCount,
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "notifications GET" });
  }
}

export async function DELETE(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const session = await getAuthSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const authSession = session as ExtendedSession;
    const result = await db.notification.deleteMany({
      where: {
        userId: authSession.user.id,
        read: true,
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    return NextResponse.json({ deleted: result.count });
  } catch (error: unknown) {
    return handleApiError(error, { route: "notifications DELETE" });
  }
}
