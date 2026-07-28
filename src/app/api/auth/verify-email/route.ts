import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-errors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("verify-email", RATE_LIMITS.sendVerification);

export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return NextResponse.redirect(new URL("/?error=rate-limited", request.url));
  try {
    const { searchParams } = new URL(request.url);
    const rawToken = searchParams.get("token");

    if (!rawToken) {
      return NextResponse.redirect(new URL("/?error=missing-token", request.url));
    }

    // Hash the raw token to match the stored hash (same as forgot-password flow)
    const token = createHash("sha256").update(rawToken).digest("hex");

    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken || verificationToken.expires < new Date()) {
      return NextResponse.redirect(new URL("/?error=expired-token", request.url));
    }

    // Validate token identifier prefix
    const expectedPrefix = "email-verify:";
    if (!verificationToken.identifier.startsWith(expectedPrefix)) {
      return NextResponse.redirect(new URL("/?error=invalid-token", request.url));
    }

    // Extract email from identifier (format: "email-verify:email@example.com")
    const email = verificationToken.identifier.slice(expectedPrefix.length);

    await db.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    });

    // Delete all tokens for this email (clean up stale tokens)
    await db.verificationToken.deleteMany({
      where: { identifier: `email-verify:${email}` },
    });

    return NextResponse.redirect(new URL("/?email-verified=true", request.url));
  } catch (error: unknown) {
    return handleApiError(error, { route: "auth/verify-email" });
  }
}
