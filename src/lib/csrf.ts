import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];
const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getCsrfCookie(): { name: string; value: string; serialize: string } {
  const token = generateToken();
  const isProd = process.env.NODE_ENV === "production";
  return {
    name: CSRF_COOKIE_NAME,
    value: token,
    serialize: `${CSRF_COOKIE_NAME}=${token}; Path=/; SameSite=Strict; Max-Age=86400${isProd ? "; Secure" : ""}`,
  };
}

export function validateCsrf(request: NextRequest): boolean {
  if (SAFE_METHODS.includes(request.method)) {
    return true;
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    return false;
  }

  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  const encoder = new TextEncoder();
  const cookieBytes = encoder.encode(cookieToken);
  const headerBytes = encoder.encode(headerToken);

  return crypto.timingSafeEqual(cookieBytes, headerBytes);
}

export function csrfProtection(request: NextRequest): NextResponse | null {
  if (SAFE_METHODS.includes(request.method)) {
    return null;
  }

  if (!validateCsrf(request)) {
    return NextResponse.json(
      { error: "Недействительный CSRF-токен" },
      { status: 403 },
    );
  }

  return null;
}
