import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";

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
    const normalizedEmail = email.toLowerCase();

    // Проверяем, существует ли пользователь (case-insensitive email check)
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ошибка регистрации" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate verification token
    const token = crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create user and verification token atomically
    const user = await db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
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

      await tx.verificationToken.create({
        data: {
          identifier: `email-verify:${email}`,
          token,
          expires,
        },
      });

      return createdUser;
    });

    const baseUrl = env.nextAuthUrl || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

    // Await email send with built-in retry — failures are logged but don't
    // block the registration response
    const emailSent = await sendEmail({
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
    });

    if (!emailSent) {
      log.error("Verification email could not be sent after retries", { email: user.email });
    }

    return NextResponse.json(
      { message: "Регистрация успешна", user },
      { status: 201 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "auth/register" });
  }
}
