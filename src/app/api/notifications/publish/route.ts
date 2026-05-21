import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { pushNotification, pushUnreadCount } from "@/lib/sse";
import type { NotificationItem } from "@/lib/stores/notifications";

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { userId, notification } = body as {
      userId: string;
      notification: NotificationItem;
    };

    pushNotification(userId, notification);

    if (body.unreadCount !== undefined) {
      pushUnreadCount(userId, body.unreadCount);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
