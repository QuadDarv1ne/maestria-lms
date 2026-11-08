import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  getAuthSession,
  requireAuth,
  authErrorResponse,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { invalidateJwtUserCache } from "@/lib/jwt-user-cache";
import { handleApiError } from "@/lib/api-errors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { passwordStrengthSchema } from "@/lib/password-strength";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("passwordChange", RATE_LIMITS.passwordChange);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль"),
  newPassword: passwordStrengthSchema,
});

/**
 * PUT /api/user/password — change the caller's own password.
 *
 * Until now the only way to change a password was the e-mail reset flow, so a
 * signed-in user who suspected a leak had to sign out, request a link and wait
 * for delivery. This endpoint makes the routine change possible without
 * leaving the session.
 *
 * Two rules mirror the reset flow:
 * - the current password is required, because a stolen session alone must not
 *   be enough to lock the real owner out;
 * - success bumps `sessionVersion`, which retires every token issued before
 *   the change — including the caller's own, so the client signs in again.
 */
export async function PUT(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const userId = session.user.id;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Требуется тело запроса" }, { status: 400 });
    }

    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 },
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "Новый пароль должен отличаться от текущего" },
        { status: 400 },
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    // Accounts created through an OAuth provider have no password to change;
    // the reset flow (which also proves mailbox ownership) is the way in.
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "У аккаунта нет пароля. Воспользуйтесь восстановлением пароля по email." },
        { status: 400 },
      );
    }

    const passwordOk = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordOk) {
      log.warn("Password change rejected: wrong current password", { userId });
      return NextResponse.json({ error: "Неверный текущий пароль" }, { status: 403 });
    }

    const passwordHash = await hashPassword(newPassword);

    await db.user.update({
      where: { id: userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    invalidateJwtUserCache(userId);

    log.info("Password changed by user", { userId });

    return NextResponse.json(
      {
        message: "Пароль изменён. Войдите заново с новым паролем.",
        reauthenticationRequired: true,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "user/password PUT" });
  }
}
