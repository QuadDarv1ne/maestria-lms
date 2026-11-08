/**
 * Payment service — orchestration layer that ties together:
 *   - database (Payment model)
 *   - promo code validation
 *   - provider abstraction
 *   - 54-ФЗ receipt generation
 *
 * The route handlers in `src/app/api/payments/` should call this service
 * rather than touching providers or DB directly.
 */

import { db, Prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { validatePromoCode, redeemPromoCode } from "@/lib/promo-code";
import { createNotification } from "@/lib/notifications";
import { dispatchEmail } from "@/lib/email-dispatch";
import { coursePurchaseEmail } from "@/lib/emails";
import crypto from "crypto";
import {
  type ProviderName,
  type PaymentMethod,
  type PaymentResult,
  type CreatePaymentInput,
  type PaymentStatus,
} from "./types";
import { getProvider, pickProviderForMethod, parseProviderName } from "./registry";
import { buildCourseReceipt } from "./receipts";

/** Validate method string from API input → typed PaymentMethod. */
const METHOD_VALUES = new Set<PaymentMethod>([
  "CARD", "SBP", "YOOMONEY", "SBERPAY", "TPAY", "YANDEX_PAY", "OZON_CARD", "WALLET",
]);

export function parsePaymentMethod(value: string | null | undefined): PaymentMethod | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return METHOD_VALUES.has(upper as PaymentMethod) ? (upper as PaymentMethod) : null;
}

/**
 * Resolve a (provider, method) pair from the API request body.
 * Caller may pass either `provider` + `method`, or just `method` (then we
 * pick the provider automatically), or a legacy `paymentMethod` value such
 * as "yookassa"/"tinkoff"/"sbp"/"card" (kept for backward compatibility).
 */
export function resolveProviderAndMethod(input: {
  provider?: string | null;
  method?: string | null;
  legacyPaymentMethod?: string | null; // old "yookassa" / "tinkoff" / "sbp" / "card"
}): { provider: ProviderName; method: PaymentMethod } | { error: string } {
  const explicitProvider = parseProviderName(input.provider ?? null);
  const explicitMethod = parsePaymentMethod(input.method ?? null);

  // Legacy compatibility: map old values to new (provider, method) pairs.
  if (!explicitMethod && input.legacyPaymentMethod) {
    const legacyMap: Record<string, { provider: ProviderName; method: PaymentMethod }> = {
      sbp:      { provider: "YOOKASSA", method: "SBP" },
      card:     { provider: "YOOKASSA", method: "CARD" },
      yookassa: { provider: "YOOKASSA", method: "CARD" },
      tinkoff:  { provider: "TINKOFF",  method: "CARD" },
    };
    const mapped = legacyMap[input.legacyPaymentMethod.toLowerCase()];
    if (mapped) {
      return {
        provider: explicitProvider ?? mapped.provider,
        method: explicitMethod ?? mapped.method,
      };
    }
  }

  if (!explicitMethod) {
    return { error: "Неизвестный метод оплаты" };
  }

  return {
    provider: explicitProvider ?? pickProviderForMethod(explicitMethod),
    method: explicitMethod,
  };
}

export interface CreatePaymentOptions {
  userId: string;
  courseId: string;
  method: PaymentMethod;
  provider?: ProviderName;
  promoCode?: string;
}

export interface CreatedPayment {
  /** Internal payment id. */
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: PaymentMethod;
  provider: ProviderName;
  /** Where to send the user next (redirect URL or QR page). */
  confirmationUrl?: string;
  qrCode?: string;
  providerPaymentId?: string;
  testMode?: boolean;
  /** True when a pending payment already existed — nothing new was created. */
  existing?: boolean;
}

/**
 * Create a payment record and call the provider's createPayment API.
 * Returns everything the client needs to proceed (redirect URL or QR payload).
 *
 * Throws on unrecoverable errors (DB failure, provider 5xx after retries).
 * Caller is responsible for translating to HTTP responses.
 */
export async function createCoursePayment(opts: CreatePaymentOptions): Promise<CreatedPayment> {
  const { userId, courseId, method } = opts;
  const providerName = opts.provider ?? pickProviderForMethod(method);
  const provider = getProvider(providerName);

  // 1. Load course
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || !course.isPublished) {
    throw new ServiceError("COURSE_NOT_FOUND", "Курс не найден");
  }
  if (course.visibility === "private") {
    throw new ServiceError("PRIVATE_COURSE", "Запись на этот курс доступна только по приглашению");
  }
  if (course.price === 0) {
    throw new ServiceError("FREE_COURSE", "Этот курс бесплатный — оплата не требуется");
  }
  // Reject a full course before the provider is involved: enrollment cannot be
  // granted afterwards (the money has already been captured), and silently
  // overbooking would make maxStudents decorative for this entry point.
  if (course.maxStudents && course.studentCount >= course.maxStudents) {
    throw new ServiceError("COURSE_FULL", "Достигнут лимит студентов на курсе");
  }

  // 2. Promo code
  let finalAmount = course.price;
  let discountAmount = 0;
  let promoCodeId: string | null = null;
  if (opts.promoCode) {
    const promo = await validatePromoCode(opts.promoCode, course.price, userId, courseId);
    if (!promo.valid) {
      throw new ServiceError("PROMO_INVALID", promo.error ?? "Промокод недействителен");
    }
    finalAmount = promo.finalPrice ?? course.price;
    discountAmount = promo.discountAmount ?? 0;
    promoCodeId = promo.promoCode?.id ?? null;
  }

  // 3. Check existing pending/completed payment (race-safe via transaction below)
  const existing = await db.payment.findFirst({
    where: { userId, courseId, status: { in: ["pending", "completed"] } },
    select: {
      id: true, amount: true, currency: true, status: true,
      paymentMethod: true, paymentProvider: true, paymentData: true,
    },
  });
  if (existing?.status === "completed") {
    throw new ServiceError("ALREADY_PAID", "Курс уже оплачен");
  }
  if (existing?.status === "pending") {
    // Return existing payment's confirmation data if we still have it.
    return existingAsCreated(existing, { provider: providerName, method });
  }

  // 4. Generate idempotency key + payment id up-front
  const idempotenceKey = crypto.randomUUID();
  const paymentId = crypto.randomUUID();

  // 5. Create DB record inside transaction (race condition protection).
  //    Provider call happens AFTER commit so we don't hold a long-running
  //    transaction across an HTTP request.
  const created = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const again = await tx.payment.findFirst({
      where: { userId, courseId, status: { in: ["pending", "completed"] } },
    });
    if (again?.status === "completed") throw new ServiceError("ALREADY_PAID", "Курс уже оплачен");
    if (again?.status === "pending") return { existing: again, created: null as null | { id: string } };

    const payment = await tx.payment.create({
      data: {
        id: paymentId,
        userId,
        courseId,
        amount: finalAmount,
        currency: course.currency || "RUB",
        status: "pending",
        paymentMethod: method.toLowerCase(), // store as lowercase string for backward compat
        paymentProvider: providerName,
        transactionId: `pending_${idempotenceKey}`, // placeholder until provider responds
        promoCodeId,
        discountAmount,
      },
    });
    return { existing: null as null | typeof payment, created: payment };
  });

  if (created.existing) {
    return existingAsCreated(created.existing, { provider: providerName, method });
  }

  // Use the id of the row that was actually persisted (matters when the
  // database assigns/defaults ids).
  const record = created.created;
  if (!record) {
    throw new ServiceError("PAYMENT_NOT_FOUND", "Не удалось создать платёж");
  }
  const createdPaymentId = record.id;

  // 6. Provider not configured? — return test mode so client can simulate.
  if (!provider.isConfigured()) {
    log.warn("Provider not configured, returning testMode", { provider: providerName });
    return {
      id: createdPaymentId,
      amount: finalAmount,
      currency: course.currency || "RUB",
      status: "pending",
      paymentMethod: method,
      provider: providerName,
      testMode: true,
    };
  }

  // 7. Build receipt (54-ФЗ) — only for providers that support it.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, phone: true },
  });
  const receipt = (providerName === "YOOKASSA" || providerName === "TINKOFF" || providerName === "CLOUDPAYMENTS")
    ? buildCourseReceipt({
        courseTitle: course.title,
        amount: finalAmount,
        customer: {
          email: user?.email,
          fullName: user?.name ?? undefined,
          phone: user?.phone ?? undefined,
        },
        vatCode: 4, // УСН — adjust if you're on ОСН (1 = НДС 20%)
      })
    : undefined;

  // 8. Call provider
  const input: CreatePaymentInput = {
    paymentId: createdPaymentId,
    idempotenceKey,
    amount: finalAmount,
    currency: "RUB",
    description: `Оплата курса "${course.title}" — ${env.siteUrl}`,
    returnUrl: `${env.siteUrl}/payment/${createdPaymentId}`,
    method,
    receipt,
    customer: {
      email: user?.email,
      fullName: user?.name ?? undefined,
      phone: user?.phone ?? undefined,
    },
    metadata: {
      paymentId: createdPaymentId,
      userId,
      courseId,
    },
  };

  let result: PaymentResult;
  try {
    result = await provider.createPayment(input);
  } catch (err) {
    // Mark payment failed so the user can retry.
    await db.payment.updateMany({
      where: { id: createdPaymentId, status: "pending" },
      data: { status: "failed" },
    });
    log.error("Provider createPayment failed", {
      paymentId: createdPaymentId, provider: providerName, error: err instanceof Error ? err.message : String(err),
    });
    throw new ServiceError(
      "PROVIDER_ERROR",
      `Ошибка платёжного провайдера: ${err instanceof Error ? err.message : "unknown"}`,
    );
  }

  // 9. Store provider payment id + confirmation URL
  await db.payment.update({
    where: { id: createdPaymentId },
    data: {
      transactionId: result.providerPaymentId,
      paymentData: JSON.stringify({
        idempotenceKey,
        providerPaymentId: result.providerPaymentId,
        confirmationUrl: result.confirmationUrl ?? null,
        qrCode: result.qrCode ?? null,
        provider: providerName,
        method,
        receiptGenerated: !!receipt,
      }),
    },
  });

  // 10. NOTE: the promo code is NOT redeemed here. Redemption used to happen
  //     as soon as the provider accepted the payment creation, but a payment
  //     that is later canceled (payment.canceled webhook) burned the user's
  //     attempt anyway. completePayment() redeems the code only when the
  //     money has actually arrived (promoCodeId is stored on the row).

  return {
    id: createdPaymentId,
    amount: finalAmount,
    currency: course.currency || "RUB",
    status: "pending",
    paymentMethod: method,
    provider: providerName,
    confirmationUrl: result.confirmationUrl,
    qrCode: result.qrCode,
    providerPaymentId: result.providerPaymentId,
  };
}

function existingAsCreated(
  existing: {
    id: string;
    amount: number;
    currency: string;
    paymentMethod: string | null;
    paymentProvider: string | null;
    paymentData: string | null;
  },
  fallback: { provider: ProviderName; method: PaymentMethod },
): CreatedPayment {
  let confirmationUrl: string | undefined;
  let qrCode: string | undefined;
  if (existing.paymentData) {
    try {
      const data = JSON.parse(existing.paymentData);
      confirmationUrl = data.confirmationUrl ?? undefined;
      qrCode = data.qrCode ?? undefined;
    } catch {
      // ignore
    }
  }

  // A pending payment belongs to the provider/method it was created with.
  // Labeling it with the values of the CURRENT request would present a
  // YooKassa redirect as "Tinkoff" when the user retries with another method
  // and send the client to the wrong gateway. Fall back to the requested
  // pair only for legacy rows without a stored provider.
  const provider = parseProviderName(existing.paymentProvider) ?? fallback.provider;
  const method = parsePaymentMethod(existing.paymentMethod) ?? fallback.method;

  return {
    id: existing.id,
    amount: existing.amount,
    currency: existing.currency,
    status: "pending",
    paymentMethod: method,
    provider,
    confirmationUrl,
    qrCode,
    existing: true,
  };
}

/**
 * Idempotently mark a payment as completed — used by webhook handler.
 * Atomically: updates status, creates enrollment, increments student count,
 * schedules email + notification. Returns whether this call actually did
 * the work (false = already completed by an earlier call).
 */
export async function completePayment(internalPaymentId: string, transactionId: string): Promise<{
  alreadyCompleted: boolean;
  payment?: { id: string; userId: string; courseId: string };
}> {
  const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const payment = await tx.payment.findUnique({
      where: { id: internalPaymentId },
      include: { course: true, user: true },
    });
    if (!payment) throw new ServiceError("PAYMENT_NOT_FOUND", "Платёж не найден");
    if (payment.status === "completed") return { alreadyCompleted: true, payment };

    // Race-safe updateMany — only the first concurrent call succeeds.
    const updateResult = await tx.payment.updateMany({
      where: { id: internalPaymentId, status: "pending" },
      data: { status: "completed", transactionId, updatedAt: new Date() },
    });
    if (updateResult.count === 0) return { alreadyCompleted: true, payment };

    // studentCount tracks distinct enrollments, so it moves only when the
    // enrollment row is actually created. An unconditional increment
    // double-counts a learner who was enrolled for free before paying, or who
    // re-purchases after a refund. This mirrors the guard in
    // /api/payments/[id]/simulate-complete — the two completion paths must not
    // disagree about the same counter.
    const existingEnrollment = await tx.enrollment.findUnique({
      where: { userId_courseId: { userId: payment.userId, courseId: payment.courseId } },
      select: { id: true },
    });
    if (!existingEnrollment) {
      await tx.course.updateMany({
        where: { id: payment.courseId },
        data: { studentCount: { increment: 1 } },
      });
    }

    await tx.enrollment.upsert({
      where: { userId_courseId: { userId: payment.userId, courseId: payment.courseId } },
      create: { userId: payment.userId, courseId: payment.courseId, status: "active", progress: 0 },
      update: { status: "active" },
    });

    return { alreadyCompleted: false, payment };
  });

  // Redeem the promo code only after the money has actually arrived. The call
  // is idempotent (redeemPromoCode skips users already recorded in usedBy),
  // so a repeated completion attempt cannot burn the attempt twice — and a
  // canceled payment never reaches this point, which keeps the attempt intact.
  if (!result.alreadyCompleted && result.payment?.promoCodeId) {
    await redeemPromoCode(result.payment.promoCodeId, result.payment.userId).catch(
      (err: unknown) => {
        log.error("Promo code redemption failed", {
          paymentId: result.payment?.id,
          promoCodeId: result.payment?.promoCodeId,
          error: String(err),
        });
      },
    );
  }

  return {
    alreadyCompleted: result.alreadyCompleted,
    payment: result.payment ? { id: result.payment.id, userId: result.payment.userId, courseId: result.payment.courseId } : undefined,
  };
}

/**
 * Idempotently mark a payment as refunded — cancels the enrollment.
 */
export async function markPaymentRefunded(internalPaymentId: string, refundData: {
  providerRefundId?: string;
  refundAmount?: number;
}): Promise<{ alreadyProcessed: boolean }> {
  const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const payment = await tx.payment.findUnique({ where: { id: internalPaymentId } });
    if (!payment) throw new ServiceError("PAYMENT_NOT_FOUND", "Платёж не найден");
    if (payment.status === "refunded") return { alreadyProcessed: true };

    // paymentData also carries idempotenceKey / providerPaymentId /
    // confirmationUrl, which reconciliation and support still need after a
    // refund — merge instead of overwriting the whole JSON blob.
    let previousData: Record<string, unknown> = {};
    if (payment.paymentData) {
      try {
        const parsed: unknown = JSON.parse(payment.paymentData);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          previousData = parsed as Record<string, unknown>;
        }
      } catch {
        log.warn("Corrupted paymentData on refund, replacing it", { paymentId: internalPaymentId });
      }
    }

    const updateResult = await tx.payment.updateMany({
      where: { id: internalPaymentId, status: "completed" },
      data: {
        status: "refunded",
        paymentData: JSON.stringify({
          ...previousData,
          refundedAt: new Date().toISOString(),
          refundAmount: refundData.refundAmount ?? payment.amount,
          providerRefundId: refundData.providerRefundId ?? null,
          source: "webhook",
        }),
      },
    });
    if (updateResult.count === 0) return { alreadyProcessed: true };

    // Mirror of completePayment: studentCount only decreases when an active
    // enrollment actually existed, otherwise a refund for a learner whose
    // enrollment was already cancelled would push the counter below zero.
    const cancelled = await tx.enrollment.updateMany({
      where: { userId: payment.userId, courseId: payment.courseId, status: "active" },
      data: { status: "cancelled" },
    });
    if (cancelled.count > 0) {
      await tx.course.updateMany({
        where: { id: payment.courseId, studentCount: { gt: 0 } },
        data: { studentCount: { decrement: 1 } },
      });
    }
    return { alreadyProcessed: false };
  });
  return result;
}

/** Custom error class with a code so route handlers can map to HTTP status. */
export class ServiceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ServiceError";
  }
}

/** Map ServiceError.code → HTTP status for route handlers. */
export function serviceErrorStatus(code: string): number {
  switch (code) {
    case "COURSE_NOT_FOUND":
    case "PAYMENT_NOT_FOUND":
      return 404;
    case "ALREADY_PAID":
    case "FREE_COURSE":
    case "PRIVATE_COURSE":
    case "PROMO_INVALID":
    case "COURSE_FULL":
      return 400;
    case "PROVIDER_ERROR":
      return 502;
    default:
      return 500;
  }
}

/** Fire-and-forget notification + email after a payment completes. */
export function notifyPaymentCompleted(
  payment: { userId: string; courseId: string },
  courseTitle: string,
  userName: string | null,
  userEmail: string,
): void {
  createNotification({
    userId: payment.userId,
    type: "payment",
    title: "Оплата прошла успешно",
    message: `Оплата курса "${courseTitle}" подтверждена. Добро пожаловать!`,
    link: `/course/${payment.courseId}`,
  }).catch((err: unknown) => log.error("Failed to send payment notification", { error: err }));

  dispatchEmail({
    to: userEmail,
    ...coursePurchaseEmail(
      userName || "пользователь",
      courseTitle,
      `${env.siteUrl}/course/${payment.courseId}`,
    ),
    priority: "high",
  }).catch((err: unknown) => log.error("Failed to send purchase email", { error: err }));
}

export type PaymentSyncStatus = "completed" | "failed" | "pending" | "skipped" | "unknown";

export interface PaymentSyncOutcome {
  /** True when the provider was actually consulted and its answer applied. */
  synced: boolean;
  status: PaymentSyncStatus;
  reason?: string;
  /**
   * Only for status "completed": true when another path (webhook or a
   * concurrent sync) had already completed the payment. Callers use this to
   * avoid sending the purchase notification twice.
   */
  alreadyCompleted?: boolean;
  /** Payment identity, so a batch reconciler can notify without re-reading. */
  payment?: { id: string; userId: string; courseId: string };
}

/**
 * Pull-based reconciliation: ask the provider for the real status of a
 * pending payment. Webhooks are the primary source of truth, but they can be
 * lost (network failure, restart, Redis eviction) — then a payment that was
 * actually paid stays "pending" forever while the payment page keeps polling
 * our GET endpoint. This helper lets that same GET endpoint consult the
 * provider before answering.
 *
 * Safe to call on every request:
 *   - non-pending payments are skipped (already finalized),
 *   - placeholder transaction ids (pending_/sim_) and test-mode providers are
 *     skipped — there is nothing to ask,
 *   - provider errors are swallowed with a warn log (sync must never break
 *     the status read),
 *   - completion goes through the idempotent completePayment(), so a race
 *     with a late webhook converges instead of double-granting access.
 */
export async function syncPaymentWithProvider(paymentId: string): Promise<PaymentSyncOutcome> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    return { synced: false, status: "skipped", reason: "payment_not_found" };
  }
  if (payment.status !== "pending") {
    return { synced: false, status: "skipped", reason: `status_${payment.status}` };
  }

  // Placeholders written at creation time (pending_<idempotenceKey>) and by
  // the test-mode completion route (sim_<timestamp>) identify no provider
  // object — asking the provider for them would just fail.
  const providerPaymentId = payment.transactionId;
  if (
    !providerPaymentId ||
    providerPaymentId.startsWith("pending_") ||
    providerPaymentId.startsWith("sim_")
  ) {
    return { synced: false, status: "skipped", reason: "no_provider_payment_id" };
  }

  const providerName = parseProviderName(payment.paymentProvider);
  if (!providerName) {
    return { synced: false, status: "skipped", reason: "unknown_provider" };
  }
  const provider = getProvider(providerName);
  if (!provider.isConfigured()) {
    return { synced: false, status: "skipped", reason: "provider_not_configured" };
  }

  let providerStatus: PaymentStatus;
  try {
    providerStatus = await provider.getPaymentStatus(providerPaymentId);
  } catch (err) {
    log.warn("Payment sync: provider status check failed", {
      paymentId,
      provider: providerName,
      error: err instanceof Error ? err.message : String(err),
    });
    return { synced: false, status: "unknown", reason: "provider_error" };
  }

  if (providerStatus === "completed") {
    const result = await completePayment(payment.id, providerPaymentId);
    log.info("Payment sync: provider reports completed", {
      paymentId,
      provider: providerName,
      alreadyCompleted: result.alreadyCompleted,
    });
    return {
      synced: true,
      status: "completed",
      reason: result.alreadyCompleted ? "already_completed" : undefined,
      alreadyCompleted: result.alreadyCompleted,
      payment: result.payment,
    };
  }

  if (providerStatus === "failed") {
    await db.payment.updateMany({
      where: { id: payment.id, status: "pending" },
      data: { status: "failed" },
    });
    log.info("Payment sync: provider reports failed", { paymentId, provider: providerName });
    return { synced: true, status: "failed" };
  }

  return { synced: false, status: "pending", reason: "provider_pending" };
}
