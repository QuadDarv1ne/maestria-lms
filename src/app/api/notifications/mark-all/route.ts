import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { pushUnreadCount } from "@/lib/sse";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("notifications", RATE_LIMITS.default);

// PATCH: Mark all notifications as read (bulk operation)
export async function PATCH(request: NextRequest) {
  try {
    const blocked = checkRateLimit(request);
    if (blocked) return blocked;

    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Необходимо авторизоваться" }, { status: 401 });
    }

    await db.notification.updateMany({
      where: {
        userId: session.user.id,
        read: false,
      },
      data: { read: true },
    });

    pushUnreadCount(session.user.id, 0);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(error, { route: "notifications/mark-all" });
  }
}
