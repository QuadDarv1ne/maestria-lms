import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { parsePagination } from "@/lib/utils";

export const runtime = "nodejs";

const createPaymentSchema = z.object({
  courseId: z.string().min(1, "ID курса обязателен"),
  paymentMethod: z.enum(["sbp", "yookassa", "tinkoff", "card"]),
});

const checkRateLimit = rateLimit("payments", RATE_LIMITS.payments);
const checkPaymentsGetRateLimit = rateLimit("paymentsGet", RATE_LIMITS.payments);

// POST: Создать платёж
export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const validation = createPaymentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { courseId, paymentMethod } = validation.data;

    // Проверяем курс
    const course = await db.course.findUnique({
      where: { id: courseId },
    });

    if (!course || !course.isPublished) {
      return NextResponse.json(
        { error: "Курс не найден" },
        { status: 404 }
      );
    }

    if (course.price === 0) {
      return NextResponse.json(
        { error: "Этот курс бесплатный — оплата не требуется" },
        { status: 400 }
      );
    }

    // Проверяем, не оплачен ли уже
    const existingPayment = await db.payment.findFirst({
      where: {
        userId,
        courseId,
        status: { in: ["pending", "completed"] },
      },
    });

    if (existingPayment?.status === "completed") {
      return NextResponse.json(
        { error: "Курс уже оплачен" },
        { status: 400 }
      );
    }

    if (existingPayment?.status === "pending") {
      return NextResponse.json(
        {
          message: "У вас уже есть ожидающий платёж",
          paymentId: existingPayment.id,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
        },
        { status: 200 }
      );
    }

    // Определяем провайдера на основе метода оплаты
    const providerMap: Record<string, string> = {
      sbp: "СБП",
      yookassa: "ЮKassa",
      tinkoff: "Тинькофф",
      card: "Эквайринг",
    };

    // Wrap check and creation in a transaction to prevent race conditions
    // where concurrent requests could create duplicate payments
    const result = await db.$transaction(async (tx) => {
      // Check for existing payment INSIDE transaction to prevent race conditions
      const existingPayment = await tx.payment.findFirst({
        where: {
          userId,
          courseId,
          status: { in: ["pending", "completed"] },
        },
      });

      if (existingPayment?.status === "completed") {
        throw new Error("COURSE_ALREADY_PAID");
      }

      if (existingPayment?.status === "pending") {
        return {
          existing: true,
          payment: {
            id: existingPayment.id,
            amount: existingPayment.amount,
            currency: existingPayment.currency,
            status: existingPayment.status,
            paymentMethod: existingPayment.paymentMethod,
            paymentProvider: existingPayment.paymentProvider,
            transactionId: existingPayment.transactionId,
            createdAt: existingPayment.createdAt,
          },
        };
      }

      // Create new payment
      const payment = await tx.payment.create({
        data: {
          userId,
          courseId,
          amount: course.price,
          currency: course.currency,
          status: "pending",
          paymentMethod,
          paymentProvider: providerMap[paymentMethod] || paymentMethod,
          transactionId: `txn_${Date.now()}_${crypto.randomUUID()}`,
        },
      });

      return {
        existing: false,
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentMethod: payment.paymentMethod,
          paymentProvider: payment.paymentProvider,
          transactionId: payment.transactionId,
          createdAt: payment.createdAt,
        },
      };
    });

    if (result.existing) {
      return NextResponse.json(
        {
          message: "У вас уже есть ожидающий платёж",
          paymentId: result.payment.id,
          amount: result.payment.amount,
          currency: result.payment.currency,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        message: "Платёж создан",
        payment: result.payment,
      },
      { status: 201 }
    );
  } catch (error) {
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
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

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
    }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { route: "payments GET" });
  }
}
