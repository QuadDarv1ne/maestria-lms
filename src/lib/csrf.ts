import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

function validateCsrf(request: NextRequest): boolean {
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
