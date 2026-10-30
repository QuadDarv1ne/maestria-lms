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
import crypto from "crypto";
import {
  type ProviderName,
  type PaymentMethod,
  type PaymentResult,
  type CreatePaymentInput,
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
  });
  if (existing?.status === "completed") {
    throw new ServiceError("ALREADY_PAID", "Курс уже оплачен");
  }
  if (existing?.status === "pending") {
    // Return existing payment's confirmation data if we still have it.
    return existingAsCreated(existing, providerName, method);
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
    return existingAsCreated(created.existing, providerName, method);
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
        discountAmount,
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
    description: `Оплата курса «${course.title}» — ${env.siteUrl}`,
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

  // 10. Promo code redemption (only after provider accepted the payment)
  if (promoCodeId) {
    await redeemPromoCode(promoCodeId, userId).catch((err: unknown) => {
      log.error("Promo code redemption failed", { paymentId: createdPaymentId, promoCodeId, error: String(err) });
    });
  }

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
  existing: { id: string; amount: number; currency: string; paymentMethod: string; paymentData: string | null },
  providerName: ProviderName,
  method: PaymentMethod,
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
  return {
    id: existing.id,
    amount: existing.amount,
    currency: existing.currency,
    status: "pending",
    paymentMethod: method,
    provider: providerName,
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

    await tx.course.updateMany({
      where: { id: payment.courseId },
      data: { studentCount: { increment: 1 } },
    });

    await tx.enrollment.upsert({
      where: { userId_courseId: { userId: payment.userId, courseId: payment.courseId } },
      create: { userId: payment.userId, courseId: payment.courseId, status: "active", progress: 0 },
      update: { status: "active" },
    });

    return { alreadyCompleted: false, payment };
  });

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

    const updateResult = await tx.payment.updateMany({
      where: { id: internalPaymentId, status: "completed" },
      data: {
        status: "refunded",
        paymentData: JSON.stringify({
          refundedAt: new Date().toISOString(),
          refundAmount: refundData.refundAmount ?? payment.amount,
          providerRefundId: refundData.providerRefundId ?? null,
          source: "webhook",
        }),
      },
    });
    if (updateResult.count === 0) return { alreadyProcessed: true };

    await tx.enrollment.updateMany({
      where: { userId: payment.userId, courseId: payment.courseId, status: "active" },
      data: { status: "cancelled" },
    });
    await tx.course.updateMany({
      where: { id: payment.courseId },
      data: { studentCount: { decrement: 1 } },
    });
    return { alreadyProcessed: false };
  });
  return result;
}

/**
 * Find a payment by the provider's payment id (stored in transactionId after
 * createPayment succeeds). Used by the webhook when provider doesn't return
 * our internal id in metadata.
 */
export async function findPaymentByProviderId(providerPaymentId: string) {
  return db.payment.findFirst({
    where: {
      OR: [
        { transactionId: providerPaymentId },
        // Also check paymentData JSON for providerPaymentId field (less efficient)
      ],
    },
  });
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
      return 400;
    case "PROVIDER_ERROR":
      return 502;
    default:
      return 500;
  }
}
