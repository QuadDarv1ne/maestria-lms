/**
 * POST /api/payments/[id]/init-provider
 *
 * Initialize (or re-fetch) a payment's confirmation URL at the provider.
 * Useful when:
 *   - The original /api/payments response didn't include confirmationUrl
 *     (e.g. network error during provider call).
 *   - The user reloaded /payment/[id] page and needs a fresh redirect URL.
 *   - You want to switch providers for an existing pending payment.
 *
 * Body: { provider?: "YOOKASSA" | "TINKOFF" | ... }
 * If provider is omitted, uses the payment's existing `paymentProvider`.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";
import { validateParams, uuidSchema } from "@/lib/request-validation";
import { z } from "zod";
import { getProvider, parseProviderName } from "@/lib/payments/registry";
import type { PaymentMethod } from "@/lib/payments/types";
import { buildCourseReceipt } from "@/lib/payments/receipts";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("payments", RATE_LIMITS.payments);

const bodySchema = z.object({
  provider: z.string().optional(),
}).strict();

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
    if (!requireAuth(session)) return authErrorResponse();

    const payment = await db.payment.findUnique({
      where: { id },
      include: { course: { select: { title: true, price: true, currency: true } } },
    });

    if (!payment) {
      return NextResponse.json({ error: "Платёж не найден" }, { status: 404 });
    }
    if (payment.userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }
    if (payment.status !== "pending") {
      return NextResponse.json({ error: "Платёж уже обработан" }, { status: 400 });
    }

    let body: z.infer<typeof bodySchema> = {};
    try {
      body = bodySchema.parse(await request.json().catch(() => ({})));
    } catch (err) {
      // Empty body is fine — fall through with empty object.
      if (err instanceof z.ZodError && err.issues.some((i) => i.path.length > 0)) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
      }
    }

    // Determine provider: from body, or from payment.paymentProvider, or auto-pick.
    const providerName = parseProviderName(body.provider ?? null)
      ?? parseProviderName(payment.paymentProvider ?? null)
      ?? "YOOKASSA";
    const provider = getProvider(providerName);

    // Check if we already have a confirmation URL stored — return it without
    // re-calling the provider (idempotency).
    let existingData: { confirmationUrl?: string; qrCode?: string; yooKassaId?: string; providerPaymentId?: string } | null = null;
    if (payment.paymentData) {
      try {
        existingData = JSON.parse(payment.paymentData);
      } catch {
        log.warn("Corrupted paymentData", { paymentId: id });
      }
    }
    if (existingData?.confirmationUrl || existingData?.qrCode) {
      return NextResponse.json({
        provider: providerName,
        providerPaymentId: existingData?.providerPaymentId ?? existingData?.yooKassaId,
        confirmationUrl: existingData?.confirmationUrl,
        qrCode: existingData?.qrCode,
      });
    }

    if (!provider.isConfigured()) {
      return NextResponse.json({
        testMode: true,
        provider: providerName,
        message: `${provider.label} не настроен. Используйте simulate-complete для тестирования.`,
      });
    }

    // Call provider to create payment (this happens after /api/payments has
    // already created the DB row). The provider call is idempotent via
    // Idempotence-Key — we reuse the one stored in paymentData.
    const idempotenceKey = existingData?.providerPaymentId
      ? (existingData?.providerPaymentId ?? crypto.randomUUID())
      : crypto.randomUUID();

    const method = (payment.paymentMethod?.toUpperCase() ?? "CARD") as PaymentMethod;

    const user = await db.user.findUnique({
      where: { id: payment.userId },
      select: { email: true, name: true, phone: true },
    });

    const receipt = (providerName === "YOOKASSA" || providerName === "TINKOFF" || providerName === "CLOUDPAYMENTS")
      ? buildCourseReceipt({
          courseTitle: payment.course.title,
          amount: payment.amount,
          customer: {
            email: user?.email,
            fullName: user?.name ?? undefined,
            phone: user?.phone ?? undefined,
          },
          vatCode: 4,
        })
      : undefined;

    const result = await provider.createPayment({
      paymentId: payment.id,
      idempotenceKey,
      amount: payment.amount,
      currency: "RUB",
      description: `Оплата курса «${payment.course.title}»`,
      returnUrl: `${env.siteUrl}/payment/${payment.id}`,
      method,
      receipt,
      customer: {
        email: user?.email,
        fullName: user?.name ?? undefined,
        phone: user?.phone ?? undefined,
      },
      metadata: { paymentId: payment.id, userId: payment.userId, courseId: payment.courseId },
    });

    await db.payment.update({
      where: { id },
      data: {
        transactionId: result.providerPaymentId,
        paymentProvider: providerName,
        paymentData: JSON.stringify({
          idempotenceKey,
          providerPaymentId: result.providerPaymentId,
          confirmationUrl: result.confirmationUrl ?? null,
          qrCode: result.qrCode ?? null,
          provider: providerName,
          method,
        }),
      },
    });

    return NextResponse.json({
      provider: providerName,
      providerPaymentId: result.providerPaymentId,
      confirmationUrl: result.confirmationUrl,
      qrCode: result.qrCode,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("not implemented")) {
      log.error("Provider init failed (not implemented)", { paymentId: id, error: error.message });
      return NextResponse.json(
        { error: "Этот платёжный провайдер ещё не реализован. Используйте другой." },
        { status: 501 },
      );
    }
    if (error instanceof Error && (error.message.startsWith("YooKassa") || error.message.startsWith("Tinkoff") || error.message.startsWith("Ozon"))) {
      log.error("Provider init failed", { paymentId: id, error: error.message });
      return NextResponse.json(
        { error: "Ошибка при создании платежа у провайдера. Попробуйте позже." },
        { status: 502 },
      );
    }
    return handleApiError(error, { route: "payments/[id]/init-provider" });
  }
}
