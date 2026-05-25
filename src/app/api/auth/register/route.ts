import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";

import { z } from "zod";
import { passwordStrengthSchema } from "@/lib/password-strength";

export const runtime = "nodejs";

const registerSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: passwordStrengthSchema,
  name: z.string().min(2, "Имя должно быть не менее 2 символов").max(50, "Имя слишком длинное"),
});

const checkRateLimit = rateLimit("register", RATE_LIMITS.register);

export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { email, password, name } = validation.data;

    // Проверяем, существует ли пользователь
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ошибка регистрации" },
        { status: 409 }
      );
    }

    // Хешируем пароль
    const passwordHash = await hashPassword(password);

    // Создаём пользователя с ролью "student"
    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "student",
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Send welcome notification
    createNotification({
      userId: user.id,
      type: "system",
      title: "Добро пожаловать!",
      message: `Рады видеть вас, ${user.name}! Начните с каталога курсов.`,
      link: "catalog",
    }).catch((err) => log.error("Failed to send welcome notification", { error: err }));

    return NextResponse.json(
      { message: "Регистрация успешна", user },
      { status: 201 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "auth/register" });
  }
}
