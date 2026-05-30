import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { handleApiError } from "@/lib/api-errors";
import { env } from "@/lib/env";
import crypto from "crypto";

export const runtime = "nodejs";

export async function POST(_request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Generate verification token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.verificationToken.create({
      data: {
        identifier: `email-verify:${user.email}`,
        token,
        expires,
      },
    });

    const baseUrl = env.nextAuthUrl || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

    await sendEmail({
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

    return NextResponse.json({ message: "Verification email sent" });
  } catch (error) {
    return handleApiError(error, { route: "auth/send-verification" });
  }
}
