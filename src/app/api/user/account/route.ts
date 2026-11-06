import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse, verifyPassword } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { eraseAccount } from "@/lib/account-erasure";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("accountDelete", RATE_LIMITS.accountDelete);

const deleteAccountSchema = z.object({
  /** Current password — proof the requester owns the account. */
  password: z.string().min(1, "Пароль обязателен"),
  /** Explicit confirmation; guards against a stray request wiping an account. */
  confirm: z.literal("DELETE", {
    error: 'Для подтверждения введите "DELETE"',
  }),
});

/**
 * DELETE /api/user/account — erase the caller's personal data.
 *
 * Implemented as anonymization rather than a row delete: `Payment.userId`
 * cascades, so dropping the user would also erase the payment ledger that
 * bookkeeping law requires to be kept. See `src/lib/account-erasure.ts`.
 *
 * Requires the current password (a stolen session alone must not be enough to
 * destroy an account) and an explicit `confirm: "DELETE"` body field.
 */
export async function DELETE(request: NextRequest) {
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

    const parsed = deleteAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 },
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    // Accounts created through an OAuth provider have no password to check;
    // they must confirm via support, where ownership can be established.
    if (!user.passwordHash) {
      return NextResponse.json(
        {
          error:
            "У аккаунта нет пароля. Обратитесь в поддержку для удаления аккаунта.",
        },
        { status: 400 },
      );
    }

    const passwordOk = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!passwordOk) {
      log.warn("Account deletion rejected: wrong password", { userId });
      return NextResponse.json({ error: "Неверный пароль" }, { status: 403 });
    }

    const result = await eraseAccount(userId);

    if (!result.erased) {
      if (result.reason === "last_admin") {
        return NextResponse.json(
          {
            error:
              "Нельзя удалить последний аккаунт администратора — платформа останется без управления.",
          },
          { status: 409 },
        );
      }
      if (result.reason === "already_erased") {
        return NextResponse.json({ error: "Аккаунт уже удалён" }, { status: 409 });
      }
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    return NextResponse.json(
      {
        message:
          "Аккаунт удалён. Персональные данные анонимизированы, платёжные документы сохранены согласно законодательству.",
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "user/account DELETE" });
  }
}
