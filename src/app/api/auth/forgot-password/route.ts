import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { passwordStrengthSchema } from "@/lib/password-strength";

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

    const { email } = validation.data;

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
    const token = crypto.randomUUID();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expires = new Date(Date.now() + 3600000); // 1 час

    await db.verificationToken.create({
      data: {
        identifier: `reset-password:${email}`,
        token: tokenHash,
        expires,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL;
    if (!baseUrl) {
      log.error("NEXTAUTH_URL is not set, cannot generate password reset link", { email });
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Ошибка конфигурации. Обратитесь в поддержку." },
          { status: 500 }
        );
      }
    }
    const resetUrl = `${baseUrl || "http://localhost:3000"}/reset-password?code=${token}`;
    const isDev = process.env.NODE_ENV !== "production";

    if (isDev) {
      log.info("Password reset token generated (dev mode)", {
        email,
        tokenPrefix: token.slice(0, 8),
        expires: expires.toISOString(),
      });
    }

    await sendEmail({
      to: email,
      subject: "Сброс пароля — Maestria LMS",
      html: `
        <p>Здравствуйте!</p>
        <p>Вы запросили сброс пароля для аккаунта Maestria LMS.</p>
        <p>Перейдите по ссылке ниже для сброса пароля:</p>
        <p><a href="${resetUrl}">Сбросить пароль</a></p>
        <p>Ссылка действительна в течение 1 часа.</p>
        <p>Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
      `,
      text: `Перейдите по ссылке для сброса пароля: ${resetUrl}`,
    });

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

    // Атомарно: обновляем пароль и удаляем ВСЕ токены для этого email
    await db.$transaction([
      db.user.update({
        where: { email },
        data: { passwordHash },
      }),
      db.verificationToken.deleteMany({
        where: { identifier: `reset-password:${email}` },
      }),
    ]);

    return NextResponse.json(
      { message: "Пароль успешно изменён" },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "auth/forgot-password PUT" });
  }
}
