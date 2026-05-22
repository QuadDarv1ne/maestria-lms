import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import type { CreateNotificationInput } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Необходимо авторизоваться" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const input = body as CreateNotificationInput;

    if (!input.userId || !input.type || !input.title || !input.message) {
      return NextResponse.json(
        { error: "Необходимо указать userId, type, title и message" },
        { status: 400 }
      );
    }

    const notification = await createNotification(input);

    return NextResponse.json({ ok: true, notification });
  } catch (error) {
    return handleApiError(error, { route: "notifications/publish" });
  }
}
