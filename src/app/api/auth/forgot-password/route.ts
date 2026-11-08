import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { invalidateJwtUserCache } from "@/lib/jwt-user-cache";
import { env } from "@/lib/env";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { dispatchEmail } from "@/lib/email-dispatch";
import { passwordStrengthSchema } from "@/lib/password-strength";
import { MS } from "@/lib/constants";
import { passwordResetEmail } from "@/lib/emails";

export const runtime = "nodejs";

const forgotPasswordSchema = z.object({
  email: z.string().email("Введите корректный email"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Токен обязателен"),
  password: passwordStrengthSchema,
});

const checkRateLimit = rateLimit("forgotPassword", RATE_LIMITS.forgotPassword);
const checkResetRateLimit = rateLimit("resetPassword", RATE_LIMITS.resetPassword);

// POST: Запрос на сброс пароля
export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const validation = forgotPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { email: rawEmail } = validation.data;
    const email = rawEmail.toLowerCase();

    // Проверяем, существует ли пользователь
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Не раскрываем информацию о существовании email
      return NextResponse.json(
        { message: "Если аккаунт существует, на email будет отправлена инструкция по сбросу пароля" },
        { status: 200 }
      );
    }

    // Создаём токен верификации
    const token = randomUUID();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expires = new Date(Date.now() + MS.HOUR);

    await db.verificationToken.create({
      data: {
        identifier: `reset-password:${email}`,
        token: tokenHash,
        expires,
      },
    });

    const baseUrl = env.nextAuthUrl;
    if (!baseUrl) {
      log.error("NEXTAUTH_URL is not set, cannot generate password reset link", { email });
      if (env.isProduction) {
        return NextResponse.json(
          { error: "Ошибка конфигурации. Обратитесь в поддержку." },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: "Ошибка конфигурации сервера. NEXTAUTH_URL не установлен." },
        { status: 500 }
      );
    }
    const resetUrl = `${baseUrl}/reset-password?code=${token}`;
    const isDev = !env.isProduction;

    if (isDev) {
      log.info("Password reset token generated (dev mode)", {
        email,
        tokenPrefix: token.slice(0, 8),
        expires: expires.toISOString(),
      });
    }

    // Queued rather than awaited: the direct path held the response for the
    // whole Resend retry sequence. The queue retries with backoff and logs the
    // failure; the response stays 200 either way to avoid user enumeration.
    const emailQueued = await dispatchEmail({
      to: email,
      ...passwordResetEmail(resetUrl),
      priority: "high",
    });

    if (!emailQueued) {
      log.error("Password reset email could not be queued or sent", { email });
    }

    return NextResponse.json(
      {
        message: "Если аккаунт существует, на email будет отправлена инструкция по сбросу пароля",
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "auth/forgot-password POST" });
  }
}

// PUT: Сброс пароля с использованием токена
export async function PUT(request: NextRequest) {
  const blocked = checkResetRateLimit(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const validation = resetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { token, password } = validation.data;

    // Используем SHA-256 (детерминированный) для поиска токена
    const tokenHash = createHash("sha256").update(token).digest("hex");

    // Ищем токен верификации
    const verificationToken = await db.verificationToken.findUnique({
      where: { token: tokenHash },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Недействительный токен" },
        { status: 400 }
      );
    }

    if (verificationToken.expires < new Date()) {
      // Удаляем просроченный токен
      await db.verificationToken.delete({ where: { token: tokenHash } });
      return NextResponse.json(
        { error: "Токен истёк. Запросите новый" },
        { status: 400 }
      );
    }

    // Безопасно извлекаем email: убираем известный префикс
    const expectedPrefix = "reset-password:";
    if (!verificationToken.identifier.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "Недействительный токен" },
        { status: 400 }
      );
    }
    const email = verificationToken.identifier.slice(expectedPrefix.length);

    // Хешируем новый пароль
    const passwordHash = await hashPassword(password);

    // Атомарно: обновляем пароль, отзываем все выданные сессии и удаляем ВСЕ
    // токены для этого email.
    // `sessionVersion++` — единственный способ погасить уже выданные JWT
    // (они живут 30 дней и не проверяются по БД): jwt-callback отвергнет токен,
    // версия которого отстала от строки пользователя. Без этого украденная
    // cookie продолжала работать после «восстановления» аккаунта.
    // Interactive transaction: the array form requires Prisma-native promises,
    // which the lazy `db` proxy cannot produce (it returns ordinary promises).
    const rotatedUser = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { email },
        data: { passwordHash, sessionVersion: { increment: 1 } },
        select: { id: true },
      });
      await tx.session.deleteMany({ where: { userId: updated.id } });
      await tx.verificationToken.deleteMany({
        where: { identifier: `reset-password:${email}` },
      });
      return updated;
    });

    invalidateJwtUserCache(rotatedUser.id);

    return NextResponse.json(
      { message: "Пароль успешно изменён" },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "auth/forgot-password PUT" });
  }
}
