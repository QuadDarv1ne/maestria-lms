import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

/**
 * Origin-based CSRF protection (defence-in-depth).
 *
 * The primary CSRF defence is the SameSite=Strict session cookie configured in
 * auth.ts.  This function adds a secondary check by validating the Origin
 * header against the Host header on mutation requests (POST/PUT/PATCH/DELETE).
 *
 * If the Origin header is absent the request is allowed through – the
 * SameSite=Strict cookie already blocks CSRF in all modern browsers, and a
 * missing Origin is not a reliable signal of an attack (it may be absent in
 * server-to-server calls, extension-initiated requests, etc.).
 */
export function csrfProtection(request: NextRequest): NextResponse | null {
  if (SAFE_METHODS.includes(request.method)) {
    return null;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // No Origin header → let SameSite=Strict be the sole defence.
  if (!origin || !host) {
    return null;
  }

  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== host) {
      return NextResponse.json(
        { error: "Недействительный CSRF-токен" },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Недействительный CSRF-токен" },
      { status: 403 },
    );
  }

  return null;
}
