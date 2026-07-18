import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { handleApiError } from "@/lib/api-errors";
import { env } from "@/lib/env";
import { randomBytes } from "node:crypto";
import { MS, APP_NAME } from "@/lib/constants";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("sendVerification", RATE_LIMITS.sendVerification);

export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, emailVerified: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: "Email already verified" }, { status: 400 });
    }

    const normalizedEmail = user.email.toLowerCase();

    // Delete old unused tokens for this email
    await db.verificationToken.deleteMany({
      where: { identifier: `email-verify:${normalizedEmail}` },
    });

    // Generate verification token
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + MS.DAY);

    await db.verificationToken.create({
      data: {
        identifier: `email-verify:${normalizedEmail}`,
        token,
        expires,
      },
    });

    const baseUrl = env.siteUrl;
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: "Подтверждение email — " + APP_NAME,
      html: `
        <h2>Подтвердите ваш email</h2>
        <p>Здравствуйте, ${(user.name || "пользователь").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}!</p>
        <p>Для подтверждения email перейдите по ссылке:</p>
        <p><a href="${verifyUrl}">Подтвердить email</a></p>
        <p>Ссылка действительна 24 часа.</p>
      `,
      text: `Здравствуйте! Для подтверждения email перейдите по ссылке: ${verifyUrl}`,
    });

    return NextResponse.json({ message: "Verification email sent" });
  } catch (error: unknown) {
    return handleApiError(error, { route: "auth/send-verification" });
  }
}
