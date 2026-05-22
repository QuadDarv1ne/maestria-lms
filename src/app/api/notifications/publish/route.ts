import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import type { CreateNotificationInput } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const input = body as CreateNotificationInput;

    if (!input.userId || !input.type || !input.title || !input.message) {
      return NextResponse.json(
        { error: "Missing required fields: userId, type, title, message" },
        { status: 400 }
      );
    }

    const notification = await createNotification(input);

    return NextResponse.json({ ok: true, notification });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
