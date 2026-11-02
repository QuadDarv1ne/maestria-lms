import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { handleApiError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { reconcilePendingPayments } from "@/lib/payments/reconcile";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("paymentsReconcile", {
  windowMs: 60_000,
  maxRequests: 6,
});

const reconcileSchema = z.object({
  minAgeMinutes: z.number().int().min(0).max(24 * 60).optional(),
  maxAgeDays: z.number().int().min(1).max(365).optional(),
  batchSize: z.number().int().min(1).max(200).optional(),
});

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
  return request.headers.get("x-reconcile-secret");
}

/**
 * POST /api/payments/reconcile
 *
 * Cron entry point for batch reconciliation of stale pending payments.
 * Protected by the shared `PAYMENT_RECONCILE_SECRET` (Authorization: Bearer
 * or X-Reconcile-Secret). Disabled entirely when the secret is not configured.
 *
 * Body is optional: `{ minAgeMinutes?, maxAgeDays?, batchSize? }`.
 */
export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const configuredSecret = env.paymentReconcileSecret;
  if (!configuredSecret) {
    log.warn("Payment reconcile endpoint called but PAYMENT_RECONCILE_SECRET is not set");
    return NextResponse.json(
      { error: "Reconciliation is not configured" },
      { status: 503 },
    );
  }

  const providedSecret = extractSecret(request);
  if (!providedSecret || !safeEqual(providedSecret, configuredSecret)) {
    log.warn("Payment reconcile: unauthorized attempt", {
      hasAuthorization: request.headers.has("authorization"),
      hasSecretHeader: request.headers.has("x-reconcile-secret"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody = await request.text();
    let body: unknown = {};
    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }
    }

    const validation = reconcileSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ошибка валидации" },
        { status: 400 },
      );
    }

    const summary = await reconcilePendingPayments(validation.data);
    return NextResponse.json(
      { ok: true, ...summary },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "payments/reconcile" });
  }
}
