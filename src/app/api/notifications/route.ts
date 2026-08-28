import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { MS } from "@/lib/constants";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("notifications", RATE_LIMITS.default);

const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const url = new URL(request.url);
    const { limit, offset } = notificationsQuerySchema.parse({
      limit: url.searchParams.get("limit"),
      offset: url.searchParams.get("offset"),
    });

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.notification.count({ where: { userId: session.user.id } }),
      db.notification.count({
        where: { userId: session.user.id, read: false },
      }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n: { id: string; type: string; title: string; message: string; read: boolean; createdAt: Date; link: string | null }) => ({
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

  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const thirtyDaysAgo = new Date(Date.now() - MS.THIRTY_DAYS);

    // Clean up stale verification tokens (password reset, email verify) older than 24h
    // This runs opportunistically on notification cleanup to avoid a dedicated cron job
    const staleTokenCleanup = db.verificationToken.deleteMany({
      where: { expires: { lt: new Date(Date.now() - MS.DAY) } },
    }).catch((err: unknown) => {
      log.warn("Failed to clean up stale verification tokens", {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    const result = await db.notification.deleteMany({
      where: {
        userId: session.user.id,
        read: true,
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    // Await cleanup to keep DB tidy
    await staleTokenCleanup;

    return NextResponse.json({ deleted: result.count });
  } catch (error: unknown) {
    return handleApiError(error, { route: "notifications DELETE" });
  }
}
