import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { z } from "zod";

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

    // Update payment status
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "completed",
        transactionId,
        updatedAt: new Date(),
      },
    });

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
        progress: 0,
        enrolledAt: new Date(),
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
    const body = await request.json();

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

    const normalizedStatus = statusMap[data.status.toLowerCase()] || data.status.toLowerCase();

    if (normalizedStatus !== "completed") {
      // Update payment to failed/refunded status
      const paymentId = data.object?.id || data.object?.paymentId;
      if (paymentId) {
        await db.payment.updateMany({
          where: { id: paymentId, status: "pending" },
          data: { status: normalizedStatus === "failed" ? "failed" : "refunded" },
        });
      }
      return NextResponse.json({ received: true, status: normalizedStatus });
    }

    // Find payment by transaction ID or object ID
    const transactionId = data.object?.transactionId || data.object?.id;
    let payment = null;

    if (transactionId?.startsWith("txn_")) {
      payment = await db.payment.findFirst({
        where: { transactionId, status: "pending" },
      });
    }

    if (!payment && data.object?.id) {
      payment = await db.payment.findUnique({
        where: { id: data.object.id },
      });
    }

    if (!payment) {
      log.warn("Webhook: payment not found", { transactionId, objectId: data.object?.id });
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const _result = await completePayment(payment.id, transactionId || payment.transactionId);

    log.info("Webhook: payment completed", {
      paymentId: payment.id,
      provider,
      transactionId,
    });

    return NextResponse.json({ received: true, status: "completed" });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "PAYMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "PAYMENT_INVALID_STATUS") {
      return NextResponse.json({ error: "Payment cannot be completed", status: 400 });
    }
    return handleApiError(error, { route: "payments/webhook" });
  }
}
