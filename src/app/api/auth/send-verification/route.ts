import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { handleApiError } from "@/lib/api-errors";
import { env } from "@/lib/env";
import { randomBytes, createHash } from "node:crypto";
import { MS } from "@/lib/constants";
import { verifyEmailEmail } from "@/lib/emails";

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
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: "Email уже подтверждён" }, { status: 400 });
    }

    const normalizedEmail = user.email.toLowerCase();

    // Delete old unused tokens for this email
    await db.verificationToken.deleteMany({
      where: { identifier: `email-verify:${normalizedEmail}` },
    });

    // Generate verification token (store hash in DB, send raw token in email)
    const rawToken = randomBytes(32).toString("hex");
    const token = createHash("sha256").update(rawToken).digest("hex");
    const expires = new Date(Date.now() + MS.DAY);

    await db.verificationToken.create({
      data: {
        identifier: `email-verify:${normalizedEmail}`,
        token,
        expires,
      },
    });

    const baseUrl = env.siteUrl;
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${rawToken}`;

    await sendEmail({
      to: user.email,
      ...verifyEmailEmail(user.name || "пользователь", verifyUrl),
    });

    return NextResponse.json({ message: "Письмо с подтверждением отправлено" });
  } catch (error: unknown) {
    return handleApiError(error, { route: "auth/send-verification" });
  }
}
