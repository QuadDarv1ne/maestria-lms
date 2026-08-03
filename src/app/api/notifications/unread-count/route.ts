import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const checkRateLimit = rateLimit("notifications", RATE_LIMITS.default);

/**
 * GET /api/notifications/unread-count
 *
 * Lightweight endpoint that returns only the unread notification count.
 * More efficient than fetching all notifications just for a badge counter.
 */
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const session = await getAuthSession();
  if (!requireAuth(session)) {
    return authErrorResponse();
  }

  const userId = session.user.id;

  try {
    const count = await db.notification.count({
      where: {
        userId,
        read: false,
      },
    });

    return NextResponse.json({ data: { unreadCount: count } });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch unread count", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}