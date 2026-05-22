import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";

const checkRateLimit = rateLimit("paymentUpdate", RATE_LIMITS.paymentUpdate);
const checkPaymentGetRateLimit = rateLimit("paymentGet", RATE_LIMITS.payments);
const checkPaymentConfirmRateLimit = rateLimit("paymentConfirm", RATE_LIMITS.paymentConfirm);

const updatePaymentStatusSchema = z.object({
  status: z.enum(["completed", "failed", "refunded"]),
});

/**
 * Ensure user is enrolled on a course after payment completion.
 * - Creates enrollment + increments studentCount if not enrolled.
 * - Reactivates inactive enrollment WITHOUT resetting progress.
 */
async function ensureEnrollment(
  tx: NonNullable<Parameters<Parameters<typeof db.$transaction>[0]>[0]>,
  userId: string,
  courseId: string,
) {
  const existingEnrollment = await tx.enrollment.findUnique({
    where: {
      userId_courseId: { userId, courseId },
    },
  });

  if (!existingEnrollment) {
    await tx.enrollment.create({
      data: {
        userId,
        courseId,
        status: "active",
        progress: 0,
      },
    });
    await tx.course.update({
      where: { id: courseId },
      data: { studentCount: { increment: 1 } },
    });
  } else if (existingEnrollment.status !== "active") {
    await tx.enrollment.update({
      where: { id: existingEnrollment.id },
      data: {
        status: "active",
        enrolledAt: new Date(),
        // Do NOT reset progress — preserve existing user progress
      },
    });
  }
}

// GET: Статус платежа
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = checkPaymentGetRateLimit(request);
  if (blocked) return blocked;
  try {
    const { id } = await params;
    const session = await getAuthSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            image: true,
            price: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Платёж не найден" },
        { status: 404 }
      );
    }

    // Проверяем, что платёж принадлежит пользователю (или пользователь — админ)
    if (payment.userId !== userId && session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Доступ запрещён" },
        { status: 403 }
      );
    }

    return NextResponse.json({ payment }, { status: 200 });
  } catch (error) {
    console.error("Ошибка получения платежа:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

// POST: Подтвердить платёж (пользователь может подтвердить только свой pending платёж).
// Это временное решение до интеграции с реальным платёжным шлюзом.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = checkPaymentConfirmRateLimit(request);
  if (blocked) return blocked;
  try {
    const { id } = await params;
    const session = await getAuthSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    const payment = await db.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Платёж не найден" },
        { status: 404 }
      );
    }

    // Пользователь может подтвердить только свой платёж
    if (payment.userId !== userId) {
      return NextResponse.json(
        { error: "Доступ запрещён" },
        { status: 403 }
      );
    }

    if (payment.status !== "pending") {
      return NextResponse.json(
        { error: `Платёж уже имеет статус "${payment.status}"` },
        { status: 400 }
      );
    }

    // Атомарное обновление: статус платежа + запись на курс
    const updatedPayment = await db.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: { status: "completed" },
      });

      await ensureEnrollment(tx, payment.userId, payment.courseId);

      return updated;
    });

    return NextResponse.json(
      { message: "Платёж подтверждён", payment: updatedPayment },
      { status: 200 }
    );
  } catch (error) {
    console.error("Ошибка подтверждения платежа:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

// PUT: Обновить статус платежа (только для администраторов).
// Обычные пользователи не могут менять статус платежа — это предотвращает
// ситуацию, когда пользователь сам одобряет свой платёж и получает бесплатный доступ.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const { id } = await params;

    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userRole = session.user.role;

    // Только администраторы могут менять статус платежа
    if (userRole !== "admin") {
      return NextResponse.json(
        { error: "Доступ запрещён" },
        { status: 403 }
      );
    }

    const payment = await db.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Платёж не найден" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updatePaymentStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Неверный статус платежа. Допустимые значения: completed, failed, refunded" },
        { status: 400 }
      );
    }

    const { status } = validation.data;

    // Атомарное обновление: статус платежа + запись на курс
    const result = await db.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: { status },
      });

      // Если платёж завершён успешно — записываем на курс
      if (status === "completed" && payment.status === "pending") {
        await ensureEnrollment(tx, payment.userId, payment.courseId);
      }

      // Если платёж возвращён — отменяем запись
      if (status === "refunded") {
        await tx.enrollment.updateMany({
          where: {
            userId: payment.userId,
            courseId: payment.courseId,
            status: "active",
          },
          data: { status: "cancelled" },
        });
      }

      return { updated, wasCompleted: status === "completed" && payment.status === "pending" };
    });

    // Send notification for completed payment
    if (result.wasCompleted) {
      const courseData = await db.course.findUnique({
        where: { id: payment.courseId },
        select: { title: true },
      });
      if (courseData) {
        createNotification({
          userId: payment.userId,
          type: "enrollment",
          title: "Оплата прошла",
          message: `Вы записаны на курс "${courseData.title}"`,
          link: `course/${payment.courseId}`,
        }).catch(() => {});
      }
    }

    return NextResponse.json(
      { message: "Статус платежа обновлён", payment: result.updated },
      { status: 200 }
    );
  } catch (error) {
    console.error("Ошибка обновления платежа:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
