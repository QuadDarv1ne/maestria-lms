import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createPayment, isYooKassaConfigured } from "@/lib/yookassa";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";
import { validateParams, uuidSchema } from "@/lib/request-validation";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("payments", RATE_LIMITS.payments);

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

    if (payment.paymentMethod !== "yookassa") {
      return NextResponse.json({ error: "Неверный метод оплаты" }, { status: 400 });
    }

    let existingData: Record<string, unknown> | null = null;
    if (payment.paymentData) {
      try {
        existingData = JSON.parse(payment.paymentData);
      } catch {
        log.warn("Corrupted paymentData in DB", { paymentId: id });
      }
    }
    if (existingData?.yooKassaId) {
      return NextResponse.json({
        confirmationUrl: existingData.confirmationUrl,
        yooKassaId: existingData.yooKassaId,
      });
    }

    if (!isYooKassaConfigured()) {
      return NextResponse.json({
        testMode: true,
        message: "ЮKassa не настроена. Используйте режим тестирования.",
      });
    }

    const returnUrl = `${env.siteUrl}/payment/${id}`;

    const result = await createPayment({
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      description: `Оплата курса "${payment.course.title}"`,
      returnUrl,
      metadata: {
        paymentId: payment.id,
        userId: payment.userId,
      },
    });

    await db.payment.update({
      where: { id },
      data: {
        paymentData: JSON.stringify({
          yooKassaId: result.yooKassaId,
          confirmationUrl: result.confirmationUrl,
        }),
      },
    });

    return NextResponse.json({
      confirmationUrl: result.confirmationUrl,
      yooKassaId: result.yooKassaId,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith("YooKassa:")) {
      log.error("YooKassa payment creation failed", { paymentId: id, error: error.message });
      return NextResponse.json(
        { error: "Ошибка при создании платежа в ЮKassa. Попробуйте позже." },
        { status: 502 }
      );
    }
    return handleApiError(error, { route: "payments/[id]/init-yookassa" });
  }
}
