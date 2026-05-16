import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const createPaymentSchema = z.object({
  courseId: z.string().min(1, "ID курса обязателен"),
  paymentMethod: z.enum(["sbp", "yookassa", "tinkoff", "card"], {
    errorMap: () => ({ message: "Выберите способ оплаты" }),
  }),
});

// POST: Создать платёж
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const validation = createPaymentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Ошибка валидации" },
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

    // Создаём платёж
    const payment = await db.payment.create({
      data: {
        userId,
        courseId,
        amount: course.price,
        currency: course.currency,
        status: "pending",
        paymentMethod,
        paymentProvider: providerMap[paymentMethod] || paymentMethod,
        transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
    });

    return NextResponse.json(
      {
        message: "Платёж создан",
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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Ошибка создания платежа:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

// GET: Список платежей пользователя
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;

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
    console.error("Ошибка получения платежей:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
