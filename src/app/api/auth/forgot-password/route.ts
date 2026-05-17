import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const forgotPasswordSchema = z.object({
  email: z.string().email("Введите корректный email"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Токен обязателен"),
  password: z.string().min(6, "Пароль должен быть не менее 6 символов"),
});

const checkRateLimit = rateLimit("forgotPassword", RATE_LIMITS.forgotPassword);

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
        token,
        expires,
      },
    });

    // В продакшене здесь отправить email с ссылкой для сброса пароля
    // Ссылка: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${token}
    console.log("[Forgot Password] Reset token for", email, ":", token);

    return NextResponse.json(
      { message: "Если аккаунт существует, на email будет отправлена инструкция по сбросу пароля" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Ошибка сброса пароля:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

// PUT: Сброс пароля с использованием токена
export async function PUT(request: NextRequest) {
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

    // Ищем токен верификации
    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Недействительный токен" },
        { status: 400 }
      );
    }

    if (verificationToken.expires < new Date()) {
      // Удаляем просроченный токен
      await db.verificationToken.delete({ where: { token } });
      return NextResponse.json(
        { error: "Токен истёк. Запросите новый" },
        { status: 400 }
      );
    }

    // Извлекаем email из идентификатора
    const email = verificationToken.identifier.replace("reset-password:", "");

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
    console.error("Ошибка сброса пароля:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
