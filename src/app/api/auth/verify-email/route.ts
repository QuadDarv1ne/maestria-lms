import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/?error=missing-token", request.url));
    }

    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken || verificationToken.expires < new Date()) {
      return NextResponse.redirect(new URL("/?error=expired-token", request.url));
    }

    // Extract email from identifier (format: "email-verify:email@example.com")
    const email = verificationToken.identifier.replace("email-verify:", "");

    await db.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    });

    // Delete the used token
    await db.verificationToken.delete({
      where: { token },
    });

    return NextResponse.redirect(new URL("/?email-verified=true", request.url));
  } catch (error: unknown) {
    return handleApiError(error, { route: "auth/verify-email" });
  }
}
