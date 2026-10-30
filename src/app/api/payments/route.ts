import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { parsePagination } from "@/lib/utils";
import {
  createCoursePayment,
  resolveProviderAndMethod,
  ServiceError,
  serviceErrorStatus,
} from "@/lib/payments/service";
import { getAvailablePaymentOptions } from "@/lib/payments/registry";

export const runtime = "nodejs";

// Accept both legacy (sbp/yookassa/tinkoff/card) and new (CARD/SBP/YOOMONEY/...)
// method values. The service layer normalizes them to the (provider, method) pair.
const createPaymentSchema = z.object({
  courseId: z.string().min(1, "ID курса обязателен"),
  // New API: explicit provider + method
  provider: z.string().optional(),
  method: z.string().optional(),
  // Legacy API: paymentMethod enum
  paymentMethod: z.enum(["sbp", "yookassa", "tinkoff", "card"]).optional(),
  promoCode: z.string().optional(),
}).refine(
  (d) => d.method || d.paymentMethod,
  { message: "Укажите method (CARD/SBP/YOOMONEY/...) или paymentMethod (legacy)" },
);

const checkRateLimit = rateLimit("payments", RATE_LIMITS.payments);
const checkPaymentsGetRateLimit = rateLimit("paymentsGet", RATE_LIMITS.payments);

// POST: Создать платёж
export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const userId = session.user.id;

    const body = await request.json();
    const validation = createPaymentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { courseId, provider, method, paymentMethod: legacyMethod, promoCode: promoCodeInput } = validation.data;

    // Resolve to (provider, method). Throws on unknown method.
    const resolved = resolveProviderAndMethod({
      provider: provider ?? null,
      method: method ?? null,
      legacyPaymentMethod: legacyMethod ?? null,
    });
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    // Create payment via service — calls provider, stores providerPaymentId, etc.
    const created = await createCoursePayment({
      userId,
      courseId,
      method: resolved.method,
      provider: resolved.provider,
      promoCode: promoCodeInput,
    });

    // Legacy contract: an already pending payment is reported with 200 so
    // clients can resume it instead of treating the call as a new purchase.
    if (created.existing) {
      return NextResponse.json(
        {
          message: "У вас уже есть ожидающий платёж",
          paymentId: created.id,
          amount: created.amount,
          currency: created.currency,
          paymentMethod: created.paymentMethod,
          paymentProvider: created.provider,
          confirmationUrl: created.confirmationUrl,
          qrCode: created.qrCode,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        message: created.testMode ? "Платёж создан в тестовом режиме" : "Платёж создан",
        payment: {
          id: created.id,
          amount: created.amount,
          currency: created.currency,
          status: created.status,
          paymentMethod: created.paymentMethod,
          paymentProvider: created.provider,
          testMode: created.testMode ?? false,
        },
        // Convenience fields for the client (so it doesn't have to call /init-yookassa separately):
        confirmationUrl: created.confirmationUrl,
        qrCode: created.qrCode,
        providerPaymentId: created.providerPaymentId,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: serviceErrorStatus(error.code) }
      );
    }
    if (error instanceof Error && error.message === "COURSE_ALREADY_PAID") {
      return NextResponse.json(
        { error: "Курс уже оплачен" },
        { status: 400 }
      );
    }
    return handleApiError(error, { route: "payments POST" });
  }
}

// GET: Список платежей пользователя
export async function GET(request: NextRequest) {
  const blocked = checkPaymentsGetRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams, { defaultLimit: 20, maxLimit: 50 });

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where: { userId },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.payment.count({ where: { userId } }),
    ]);

    return NextResponse.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      // Available payment options (only for configured providers) — useful for the UI.
      availableMethods: getAvailablePaymentOptions(),
    }, { status: 200 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "payments GET" });
  }
}

