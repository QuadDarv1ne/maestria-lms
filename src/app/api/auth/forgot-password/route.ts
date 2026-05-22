import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const forgotPasswordSchema = z.object({
  email: z.string().email("Введите корректный email"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Токен обязателен"),
  password: z.string().min(6, "Пароль должен быть не менее 6 символов"),
});

const checkRateLimit = rateLimit("forgotPassword", RATE_LIMITS.forgotPassword);
const checkResetRateLimit = rateLimit("resetPassword", RATE_LIMITS.forgotPassword);

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
    const expires = new Date(Date.now() + 3600000); // 1 час

    await db.verificationToken.create({
      data: {
        identifier: `reset-password:${email}`,
        token: await hashPassword(token), // хешируем токен перед сохранением
        expires,
      },
    });

    // В dev-режиме возвращаем ссылку в ответе для тестирования
    const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${token}`;
    const isDev = process.env.NODE_ENV !== "production";

    // TODO: Integrate email provider (e.g. Resend, SendGrid, AWS SES) to send reset link.
    // In production, the resetUrl should be sent via email, never returned in the API response.
    // Example integration:
    //   await sendEmail({
    //     to: email,
    //     subject: "Сброс пароля — Maestria LMS",
    //     html: `<p>Перейдите по ссылке для сброса пароля: <a href="${resetUrl}">Сбросить пароль</a></p>`,
    //   });
    if (!isDev) {
      log.info("Password reset requested (email not configured)", { email, token });
    }

    return NextResponse.json(
      {
        message: "Если аккаунт существует, на email будет отправлена инструкция по сбросу пароля",
        ...(isDev ? { resetUrl } : {}),
      },
      { status: 200 }
    );
  } catch (error) {
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

    // Хешируем входящий токен для сравнения с сохранённым
    const hashedToken = await hashPassword(token);

    // Ищем токен верификации
    const verificationToken = await db.verificationToken.findUnique({
      where: { token: hashedToken },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Недействительный токен" },
        { status: 400 }
      );
    }

    if (verificationToken.expires < new Date()) {
      // Удаляем просроченный токен
      await db.verificationToken.delete({ where: { token: hashedToken } });
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
  } catch (error) {
    return handleApiError(error, { route: "auth/forgot-password PUT" });
  }
}
