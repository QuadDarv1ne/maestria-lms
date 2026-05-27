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

    // Send email verification
    const { sendEmail } = await import("@/lib/email");
    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.verificationToken.create({
      data: {
        identifier: `email-verify:${user.email}`,
        token,
        expires,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

    sendEmail({
      to: user.email,
      subject: "Подтверждение email — Maestria LMS",
      html: `
        <h2>Подтвердите ваш email</h2>
        <p>Здравствуйте, ${user.name || "пользователь"}!</p>
        <p>Для подтверждения email перейдите по ссылке:</p>
        <p><a href="${verifyUrl}">Подтвердить email</a></p>
        <p>Ссылка действительна 24 часа.</p>
      `,
      text: `Здравствуйте! Для подтверждения email перейдите по ссылке: ${verifyUrl}`,
    }).catch((err) => log.error("Failed to send verification email", { error: err }));

    return NextResponse.json(
      { message: "Регистрация успешна", user },
      { status: 201 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "auth/register" });
  }
}
