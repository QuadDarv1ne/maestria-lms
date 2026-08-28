import { NextRequest, NextResponse } from "next/server";
import { db, Prisma } from "@/lib/db";
import { getAuthSession, requireAdmin, adminErrorResponse, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { createNotification } from "@/lib/notifications";
import { log } from "@/lib/logger";
import { validateParams, uuidSchema } from "@/lib/request-validation";
import { createRefund, isYooKassaConfigured, formatYooKassaAmount } from "@/lib/yookassa";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("admin", RATE_LIMITS.admin);

// Local transaction IDs look like "txn_<timestamp>_<uuid>" — those are NOT
// provider payment IDs and cannot be used to request a refund at YooKassa.
const LOCAL_TXN_PREFIX = "txn_";

function isProviderTxnId(transactionId: string | null): boolean {
  return !!transactionId && !transactionId.startsWith(LOCAL_TXN_PREFIX);
}

/**
 * POST /api/admin/payments/[id]/refund
 * Refund a completed payment.
 *
 * - YooKassa refund is issued first (if configured and provider txn is known).
 * - The payment is marked "refunded", the enrollment is cancelled and the
 *   course student count is decremented — atomically, to avoid double refunds.
 * - The student receives a notification + (if configured) an email.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const resolvedParams = await params;
  const id = resolvedParams.id;
  const paramCheck = validateParams({ id }, z.object({ id: uuidSchema }));
  if ("response" in paramCheck) return paramCheck.response;

  try {
    const session = await getAuthSession();
    if (!requireAdmin(session)) {
      if (!session) return authErrorResponse();
      return adminErrorResponse();
    }

    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true, currency: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Платёж не найден" }, { status: 404 });
    }

    if (payment.status === "refunded") {
      return NextResponse.json({ error: "Платёж уже возвращён" }, { status: 409 });
    }

    if (payment.status !== "completed") {
      return NextResponse.json(
        { error: "Возврат возможен только для оплаченных платежей" },
        { status: 400 },
      );
    }

    const refundAmount = payment.amount;

    // 1. Request refund at the payment provider (if real provider payment exists)
    let providerRefundId: string | null = null;
    let providerStatus: string | null = null;

    const providerPaymentId = isProviderTxnId(payment.transactionId)
      ? payment.transactionId
      : null;

    if (isYooKassaConfigured() && providerPaymentId) {
      try {
        const refund = await createRefund({
          paymentId: providerPaymentId,
          amount: formatYooKassaAmount(refundAmount),
          currency: payment.currency,
          description: `Возврат за курс "${payment.course.title}"`,
        });
        providerRefundId = refund.refundId;
        providerStatus = refund.status;
        log.info("YooKassa refund issued", {
          paymentId: payment.id,
          providerPaymentId: payment.transactionId,
          refundId: refund.refundId,
        });
      } catch (err: unknown) {
        log.error("YooKassa refund failed — leaving payment unchanged", {
          paymentId: payment.id,
          error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json(
          { error: "Не удалось оформить возврат у платёжного провайдера" },
          { status: 502 },
        );
      }
    } else {
      log.warn("Manual/mock refund: no YooKassa configuration or unknown provider txn", {
        paymentId: payment.id,
        yooKassaConfigured: isYooKassaConfigured(),
        hasProviderTxn: !!providerPaymentId,
      });
    }

    // 2. Update state atomically — race-condition safe (only the first
    //    request changes a "completed" payment to "refunded").
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const updateResult = await tx.payment.updateMany({
        where: { id, status: "completed" },
        data: {
          status: "refunded",
          paymentData: JSON.stringify({
            refundedAt: new Date().toISOString(),
            refundAmount,
            refundCurrency: payment.currency,
            providerRefundId,
            providerRefundStatus: providerStatus,
            refundedBy: session.user.id,
          }),
        },
      });

      if (updateResult.count === 0) {
        return { alreadyProcessed: true };
      }

      const cancelled = await tx.enrollment.updateMany({
        where: {
          userId: payment.userId,
          courseId: payment.courseId,
          status: "active",
        },
        data: { status: "cancelled" },
      });

      if (cancelled.count > 0) {
        await tx.course.update({
          where: { id: payment.courseId },
          data: { studentCount: { decrement: 1 } },
        });
      }

      return { alreadyProcessed: false };
    });

    if (result.alreadyProcessed) {
      return NextResponse.json(
        { error: "Платёж уже обработан (возврат невозможен)" },
        { status: 409 },
      );
    }

    // 3. Side effects outside the transaction.
    createNotification({
      userId: payment.userId,
      type: "payment",
      title: "Возврат средств",
      message: `Средства за курс "${payment.course.title}" возвращены.`,
      link: `/profile?tab=payments`,
    }).catch((err: unknown) => log.error("Failed to send refund notification", { error: err }));

    log.info("Payment refunded", {
      paymentId: payment.id,
      adminId: session.user.id,
      providerRefundId,
    });

    return NextResponse.json(
      {
        message: "Платёж возвращён",
        refund: {
          paymentId: payment.id,
          amount: refundAmount,
          currency: payment.currency,
          status: "refunded",
          providerRefundId,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/payments/[id]/refund POST" });
  }
}