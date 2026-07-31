import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { addRateLimitHeaders } from "@/lib/rate-limit";

/**
 * GET /api/notifications/unread-count
 *
 * Lightweight endpoint that returns only the unread notification count.
 * More efficient than fetching all notifications just for a badge counter.
 */
export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!requireAuth(session)) {
    return authErrorResponse();
  }

  const userId = session.user.id;
  const responseHeaders = new Headers();
  addRateLimitHeaders(responseHeaders, "default", request, userId);

  try {
    const count = await db.notification.count({
      where: {
        userId,
        read: false,
      },
    });

    return NextResponse.json(
      { data: { unreadCount: count } },
      { headers: responseHeaders },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch unread count", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}