import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";
import { z } from "zod";
import { verifyWebhookSignature } from "@/lib/webhook-verify";

export const runtime = "nodejs";

const webhookBodySchema = z.object({
  eventId: z.string().optional(),
  event: z.string().optional(),
  type: z.string().optional(),
  status: z.string(),
  object: z.object({
    id: z.string().optional(),
    paymentId: z.string().optional(),
    transactionId: z.string().optional(),
    status: z.string().optional(),
    metadata: z.object({
      paymentId: z.string().optional(),
    }).optional(),
    amount: z.object({
      value: z.string().optional(),
      currency: z.string().optional(),
    }).optional(),
  }).passthrough().optional(),
});

async function completePayment(paymentId: string, transactionId: string) {
  const result = await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { course: true, user: true },
    });

    if (!payment) {
      throw new Error("PAYMENT_NOT_FOUND");
    }

    if (payment.status === "completed") {
      return { alreadyCompleted: true, payment };
    }

    if (payment.status !== "pending") {
      throw new Error("PAYMENT_INVALID_STATUS");
    }

    // Атомарное обновление: updateMany с where status="pending" гарантирует,
    // что только первый concurrent запрос обработает платёж (race condition fix)
    const updateResult = await tx.payment.updateMany({
      where: { id: paymentId, status: "pending" },
      data: {
        status: "completed",
        transactionId,
        updatedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      return { alreadyCompleted: true, payment };
    }

    // Increment course studentCount atomically
    await tx.course.updateMany({
      where: { id: payment.courseId },
      data: { studentCount: { increment: 1 } },
    });

    // Create enrollment
    const enrollment = await tx.enrollment.upsert({
      where: {
        userId_courseId: {
          userId: payment.userId,
          courseId: payment.courseId,
        },
      },
      create: {
        userId: payment.userId,
        courseId: payment.courseId,
        status: "active",
        progress: 0,
      },
      update: {
        status: "active",
      },
    });

    return { alreadyCompleted: false, payment, enrollment };
  });

  // Send notification outside transaction
  if (!result.alreadyCompleted) {
    createNotification({
      userId: result.payment.userId,
      type: "payment",
      title: "Оплата прошла успешно",
      message: `Оплата курса "${result.payment.course.title}" подтверждена. Добро пожаловать!`,
      link: `/course/${result.payment.courseId}`,
    }).catch((err) => log.error("Failed to send payment notification", { error: err }));
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const provider = request.headers.get("x-payment-provider")?.toLowerCase();
    const rawBody = await request.text();
    const signature =
      request.headers.get("x-webhook-signature") ||
      request.headers.get("x-signature");

    // Verify HMAC signature — reject unauthenticated requests when secret is missing
    const webhookSecret = env.paymentWebhookSecret;
    if (!webhookSecret) {
      log.error("Webhook secret is not configured — rejecting request", { provider });
      return NextResponse.json({ error: "Webhook not configured" }, { status: 501 });
    }
    const { valid, algorithm } = verifyWebhookSignature({
      rawBody,
      signature,
      secret: webhookSecret,
    });

    if (!valid) {
      log.warn("Webhook signature verification failed", { provider, algorithm });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse JSON body after signature verification
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      log.warn("Invalid webhook JSON payload", { provider });
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Validate webhook payload
    const validation = webhookBodySchema.safeParse(body);
    if (!validation.success) {
      log.warn("Invalid webhook payload", { provider, error: validation.error.message });
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const data = validation.data;

    // Map provider-specific status values
    const statusMap: Record<string, string> = {
      succeeded: "completed",
      paid: "completed",
      completed: "completed",
      canceled: "failed",
      failed: "failed",
      refunded: "refunded",
    };

    const normalizedStatus = statusMap[data.status.toLowerCase()] ?? data.status.toLowerCase();

    if (normalizedStatus !== "completed") {
      // Update payment to failed/refunded status
      const paymentId = data.object?.id ?? data.object?.paymentId;
      if (!paymentId) {
        log.warn("Webhook: cannot identify payment for non-completed status", { status: normalizedStatus });
        return NextResponse.json({ error: "Payment not identified" }, { status: 400 });
      }
      await db.payment.updateMany({
        where: { id: paymentId, status: "pending" },
        data: { status: normalizedStatus === "failed" ? "failed" : "refunded" },
      });
      return NextResponse.json({ received: true, status: normalizedStatus });
    }

    // Find payment by metadata.paymentId (set during payment creation),
    // then fall back to provider's transaction ID or object ID
    const providerTransactionId = data.object?.transactionId;
    const providerObjectId = data.object?.id;
    const metaPaymentId = data.object?.metadata?.paymentId;
    let payment = null;

    if (metaPaymentId) {
      payment = await db.payment.findFirst({
        where: { id: metaPaymentId, status: "pending" },
      });
    }

    if (!payment && providerTransactionId) {
      payment = await db.payment.findFirst({
        where: { transactionId: providerTransactionId, status: "pending" },
      });
    }

    if (!payment && providerObjectId) {
      payment = await db.payment.findFirst({
        where: { id: providerObjectId, status: "pending" },
      });
    }

    if (!payment) {
      log.warn("Webhook: payment not found", { transactionId: providerTransactionId, objectId: providerObjectId });
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Use the provider's transaction ID, or fall back to the one stored in our DB
    const finalTransactionId = providerTransactionId ?? payment.transactionId;
    if (!finalTransactionId) {
      log.error("Webhook: no transaction ID available", { paymentId: payment.id });
      return NextResponse.json({ error: "Missing transaction ID" }, { status: 400 });
    }
    await completePayment(payment.id, finalTransactionId);

    log.info("Webhook: payment completed", {
      paymentId: payment.id,
      provider,
      transactionId: finalTransactionId,
    });

    return NextResponse.json({ received: true, status: "completed" });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "PAYMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "PAYMENT_INVALID_STATUS") {
      return NextResponse.json({ error: "Payment cannot be completed" }, { status: 400 });
    }
    return handleApiError(error, { route: "payments/webhook" });
  }
}
