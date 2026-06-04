import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];
const CSRF_COOKIE_NAME = "csrf-token";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getCsrfCookie(): { name: string; value: string; serialize: string } {
  const token = generateToken();
  const isProd = env.isProduction;
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

  // Origin-based CSRF protection.
  // The SameSite=Strict cookie gives us defence-in-depth; validating the
  // Origin header is sufficient for all browser-initiated requests without
  // requiring client-side cooperation to mirror the cookie into a header.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
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
