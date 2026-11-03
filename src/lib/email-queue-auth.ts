import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

/** Constant-time string comparison — the secret must not leak via timing. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function extractSecret(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  return request.headers.get("x-email-secret");
}

/**
 * Guard for the email queue endpoints.
 *
 * Protected by the shared `EMAIL_QUEUE_SECRET` (Authorization: Bearer or
 * X-Email-Secret). Disabled entirely (503) when the secret is not configured,
 * mirroring the PAYMENT_RECONCILE_SECRET pattern.
 *
 * Returns a NextResponse on failure, or null when the request is authorized.
 */
export function requireEmailQueueSecret(request: NextRequest): NextResponse | null {
  const configuredSecret = env.emailQueueSecret;
  if (!configuredSecret) {
    log.warn("Email queue endpoint called but EMAIL_QUEUE_SECRET is not set");
    return NextResponse.json(
      { error: "Email queue is not configured" },
      { status: 503 },
    );
  }

  const providedSecret = extractSecret(request);
  if (!providedSecret || !safeEqual(providedSecret, configuredSecret)) {
    log.warn("Email queue: unauthorized attempt", {
      hasAuthorization: request.headers.has("authorization"),
      hasSecretHeader: request.headers.has("x-email-secret"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
