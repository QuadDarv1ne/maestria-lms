import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";
import { z } from "zod";
import { verifyWebhookSignature } from "@/lib/webhook-verify";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { coursePurchaseEmail } from "@/lib/emails";
import { getRedisClient } from "@/lib/redis";
import { getProvider, parseProviderName, detectProviderFromWebhook } from "@/lib/payments/registry";
import type { WebhookContext, ParsedWebhook } from "@/lib/payments/types";
import { completePayment, markPaymentRefunded, ServiceError } from "@/lib/payments/service";

export const runtime = "nodejs";

// ─── Idempotency layer (Redis + in-memory fallback) ─────────────────────────
// Same as the original implementation — kept unchanged. The new
// PaymentWebhookEvent table provides an additional durable idempotency layer.
const IDEMPOTENCY_TTL = 24 * 60 * 60;
const processedWebhooks = new Map<string, { status: string; timestamp: number }>();
const MAX_IDEMPOTENCY_ENTRIES = 10000;

async function checkIdempotency(key: string): Promise<string | null> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const existing = await redis.get(`wh:${key}`);
      if (existing) return existing;
      const ok = await redis.set(`wh:${key}`, key, "EX", IDEMPOTENCY_TTL, "NX");
      if (ok) return null;
      return key;
    } catch {
      log.warn("Redis unavailable for webhook idempotency, using in-memory fallback");
    }
  }

  const now = Date.now();
  const processed = processedWebhooks.get(key);
  if (processed) return processed.status;

  if (processedWebhooks.size >= MAX_IDEMPOTENCY_ENTRIES) {
    const oldestKey = processedWebhooks.keys().next().value;
    if (oldestKey) processedWebhooks.delete(oldestKey);
  }
  processedWebhooks.set(key, { status: "pending", timestamp: now });
  return null;
}

// ─── Helper: detect a unique-constraint violation (Prisma P2002) ────────────
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2002"
  );
}

// ─── Helper: build WebhookContext from NextRequest ──────────────────────────

function buildContext(req: NextRequest, rawBody: string, providerName: string): WebhookContext {
  // Collect headers (lowercased)
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  // Client IP — take first from x-forwarded-for chain (typical for Amvera /
  // Vercel / nginx reverse proxies)
  const xff = headers["x-forwarded-for"];
  const clientIp = xff ? xff.split(",")[0].trim() : undefined;

  return {
    rawBody,
    headers,
    clientIp,
    provider: providerName as WebhookContext["provider"],
  };
}

// ─── Helper: extract client IP for legacy path (where we don't have ctx) ────
function getClientIp(req: NextRequest): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return undefined;
}

// ─── Send notification + email after successful completion ──────────────────
async function notifyUserPaymentCompleted(
  userId: string,
  courseId: string,
  courseTitle: string,
  userName: string | null,
  userEmail: string,
) {
  createNotification({
    userId,
    type: "payment",
    title: "Оплата прошла успешно",
    message: `Оплата курса "${courseTitle}" подтверждена. Добро пожаловать!`,
    link: `/course/${courseId}`,
  }).catch((err: unknown) => log.error("Failed to send payment notification", { error: err }));

  const siteUrl = env.siteUrl;
  sendEmail({
    to: userEmail,
    ...coursePurchaseEmail(
      userName || "пользователь",
      courseTitle,
      `${siteUrl}/course/${courseId}`,
    ),
  }).catch((err: unknown) => log.error("Failed to send purchase email", { error: err }));
}

// ─── POST handler ───────────────────────────────────────────────────────────

const checkWebhookRateLimit = rateLimit("webhook", { windowMs: 60_000, maxRequests: 100 });

export async function POST(request: NextRequest) {
  const blocked = checkWebhookRateLimit(request);
  if (blocked) return blocked;

  try {
    // 1. Determine provider: explicit header / query param wins, otherwise
    //    recognise the payload shape (gateways don't send a provider header).
    const providerHeader = request.headers.get("x-payment-provider");
    const url = new URL(request.url);
    const providerQuery = url.searchParams.get("provider");
    const rawBody = await request.text();

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      log.warn("Invalid webhook JSON payload", { header: providerHeader, query: providerQuery });
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const legacySecret = env.paymentWebhookSecret;
    const signature = headers["x-webhook-signature"] ?? null;

    // 2. Authenticate the request.
    //    a) Legacy path: HMAC over the raw body with PAYMENT_WEBHOOK_SECRET
    //       (used by integrations configured before the multi-gateway layer).
    //    b) Provider-native verification (signature header / IP whitelist).
    const legacyVerified =
      !!legacySecret &&
      !!signature &&
      verifyWebhookSignature({ rawBody, signature, secret: legacySecret }).valid;

    let providerName =
      parseProviderName(providerHeader ?? providerQuery) ??
      detectProviderFromWebhook(headers, body);

    // Payloads we can't recognise are only accepted through the legacy
    // HMAC-signed path; historically those were ЮKassa notifications.
    if (!providerName) {
      if (!legacySecret) {
        log.warn("Webhook secret is not configured", { header: providerHeader, query: providerQuery });
        return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 501 });
      }
      if (!legacyVerified) {
        log.warn("Webhook: unable to determine provider and signature invalid", {
          header: providerHeader,
          query: providerQuery,
        });
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
      providerName = "YOOKASSA";
    }

    const provider = getProvider(providerName);
    const ctx = buildContext(request, rawBody, providerName);

    const verified = legacyVerified || provider.verifyWebhook(ctx, body);
    if (!verified) {
      log.warn("Webhook verification failed", { provider: providerName, ip: ctx.clientIp });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 3. Parse provider-specific body into normalized event.
    let parsed: ParsedWebhook;
    try {
      parsed = provider.parseWebhook(body, ctx);
    } catch (err) {
      log.warn("Webhook parse failed", {
        provider: providerName,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: "Invalid payload structure" }, { status: 400 });
    }

    // 4. Idempotency check #1 — Redis + in-memory cache (fast path).
    const eventId = parsed.eventId || `${providerName}:${crypto.randomUUID()}`;
    const existing = await checkIdempotency(eventId);
    if (existing) {
      log.info("Duplicate webhook (Redis/in-mem), skipping", {
        eventId,
        provider: providerName,
      });
      return NextResponse.json({ received: true, status: parsed.status, idempotent: true });
    }

    // 5. Idempotency check #2 — durable via PaymentWebhookEvent table.
    //    This catches duplicates that survive Redis eviction / server restart.
    try {
      await db.paymentWebhookEvent.create({
        data: {
          provider: providerName,
          eventId,
          event: parsed.event || "unknown",
          payload: rawBody.slice(0, 65535), // cap payload size
          paymentId: parsed.internalPaymentId ?? null,
        },
      });
    } catch (err: unknown) {
      // Only a unique-constraint violation means "duplicate event". Any other
      // failure (e.g. a missing table) must not silently drop the payment —
      // log it and keep processing, since completion is idempotent anyway.
      if (isUniqueViolation(err)) {
        log.info("Duplicate webhook (DB), skipping", { eventId, provider: providerName });
        return NextResponse.json({ received: true, status: parsed.status, idempotent: true });
      }
      log.error("Failed to persist webhook event", {
        eventId,
        provider: providerName,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 6. Find our internal payment by providerPaymentId (stored in transactionId
    //    after createPayment succeeds) or by internalPaymentId from metadata.
    let payment: { id: string; userId: string; courseId: string; amount: number; status: string } | null = null;

    if (parsed.internalPaymentId) {
      payment = await db.payment.findUnique({
        where: { id: parsed.internalPaymentId },
        select: { id: true, userId: true, courseId: true, amount: true, status: true },
      });
    }

    if (!payment && parsed.providerPaymentId) {
      payment = await db.payment.findFirst({
        where: { transactionId: parsed.providerPaymentId },
        select: { id: true, userId: true, courseId: true, amount: true, status: true },
      });
    }

    if (!payment) {
      log.warn("Webhook: payment not found", {
        provider: providerName,
        providerPaymentId: parsed.providerPaymentId,
        internalPaymentId: parsed.internalPaymentId,
      });
      // Drop the audit row so the provider's retry can be processed once the
      // payment record actually exists (otherwise the unique eventId would
      // make every retry look like a duplicate).
      await db.paymentWebhookEvent.deleteMany({ where: { eventId } }).catch(() => {});
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // 7. Link webhook event to the payment (now that we know the paymentId).
    if (!parsed.internalPaymentId) {
      await db.paymentWebhookEvent.updateMany({
        where: { eventId },
        data: { paymentId: payment.id },
      });
    }

    // 8. Refund events — mark refunded, cancel enrollment.
    if (parsed.event.startsWith("refund.")) {
      if (parsed.status === "refunded") {
        await markPaymentRefunded(payment.id, {
          providerRefundId: eventId,
          refundAmount: parsed.amount ?? payment.amount,
        });
      }
      return NextResponse.json({ received: true, status: parsed.status });
    }

    // 9. Payment events — completed / failed / pending.
    if (parsed.status === "completed") {
      const result = await completePayment(payment.id, parsed.providerPaymentId || payment.id);
      if (!result.alreadyCompleted && result.payment) {
        // Fetch course title + user email for notification.
        const course = await db.course.findUnique({
          where: { id: result.payment.courseId },
          select: { title: true },
        });
        const user = await db.user.findUnique({
          where: { id: result.payment.userId },
          select: { email: true, name: true },
        });
        if (course && user) {
          await notifyUserPaymentCompleted(
            result.payment.userId,
            result.payment.courseId,
            course.title,
            user.name,
            user.email,
          );
        }
        log.info("Webhook: payment completed", {
          paymentId: payment.id, provider: providerName, transactionId: parsed.providerPaymentId,
        });
      }
      return NextResponse.json({ received: true, status: "completed" });
    }

    if (parsed.status === "failed") {
      await db.payment.updateMany({
        where: { id: payment.id, status: "pending" },
        data: { status: "failed" },
      });
      log.info("Webhook: payment failed", { paymentId: payment.id, provider: providerName });
      return NextResponse.json({ received: true, status: "failed" });
    }

    // pending — nothing to do yet.
    return NextResponse.json({ received: true, status: "pending" });
  } catch (error: unknown) {
    if (error instanceof ServiceError && error.code === "PAYMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
    return handleApiError(error, { route: "payments/webhook" });
  }
}

// Re-export for legacy callers.
export { getClientIp };
