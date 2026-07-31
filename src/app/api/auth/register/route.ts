import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { verifyEmailEmail, welcomeEmail } from "@/lib/emails";

import { z } from "zod";
import { passwordStrengthSchema } from "@/lib/password-strength";
import { MS } from "@/lib/constants";
import { createHash, randomBytes } from "node:crypto";

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
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate verification token (store hash in DB for security, like forgot-password)
    const rawToken = randomBytes(32).toString("hex");
    const token = createHash("sha256").update(rawToken).digest("hex");
    const expires = new Date(Date.now() + MS.DAY);

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
          identifier: `email-verify:${normalizedEmail}`,
          token,
          expires,
        },
      });

      return createdUser;
    }).catch(async (err) => {
      // Handle unique constraint violation (race condition)
      if (err instanceof Error && "code" in err && err.code === "P2002") {
        throw new Error("EMAIL_ALREADY_EXISTS");
      }
      throw err;
    });

    const baseUrl = env.siteUrl;
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${rawToken}`;

    // Handle race condition: user was created between our check and transaction
    if (user instanceof Error && user.message === "EMAIL_ALREADY_EXISTS") {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      );
    }

    // Fire-and-forget welcome email — delivery failure is logged but doesn't block response
    sendEmail({
      to: user.email,
      ...welcomeEmail(user.name || "пользователь", `${baseUrl}/catalog`),
    }).catch((err) => log.error("Welcome email could not be sent", { email: user.email, error: String(err) }));

    // Await verification email with built-in retry — failures are logged but don't
    // block the registration response
    const emailSent = await sendEmail({
      to: user.email,
      ...verifyEmailEmail(user.name || "пользователь", verifyUrl),
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
