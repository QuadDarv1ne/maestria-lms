import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { log } from "@/lib/logger";
import { handleApiError } from "@/lib/api-errors";
import { requireCsrf } from "@/lib/csrf";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("paymentUpdate", RATE_LIMITS.paymentUpdate);
const checkPaymentGetRateLimit = rateLimit("paymentGet", RATE_LIMITS.payments);

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
  
  const { id } = await params;
  
  try {
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
  } catch (error: unknown) {
    return handleApiError(error, { route: "payments/[id]/GET", metadata: { paymentId: id } });
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
  
  const { id } = await params;
  
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

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
      log.warn("Non-admin attempted to update payment status", {
        paymentId: id,
        userId: session.user.id,
        userRole,
      });
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
      log.warn("Invalid payment status update request", {
        paymentId: id,
        body,
        errors: validation.error.flatten(),
      });
      return NextResponse.json(
        { error: "Неверный статус платежа. Допустимые значения: completed, failed, refunded" },
        { status: 400 }
      );
    }

    const { status } = validation.data;

    // Атомарное обновление: статус платежа + запись на курс
    // Используем updateMany с where для предотвращения race condition:
    // только первый запрос обновит pending -> completed, остальные получат 0 записей
    const result = await db.$transaction(async (tx) => {
      let wasStatusUpdated = false;

      if (status === "completed") {
        // Атомарно обновляем только если статус всё ещё "pending"
        const updateResult = await tx.payment.updateMany({
          where: { id, status: "pending" },
          data: { status },
        });
        wasStatusUpdated = updateResult.count > 0;

        // Если статус не был обновлён (уже не pending), получаем актуальный платёж
        if (!wasStatusUpdated) {
          const currentPayment = await tx.payment.findUnique({ where: { id } });
          if (!currentPayment) {
            return { error: "Платёж не найден", status: 404 as const };
          }
          // Если платёж уже completed — возвращаем его без дублирования enrollment
          return { updated: currentPayment, wasCompleted: false, alreadyCompleted: currentPayment.status === "completed" as const, status: 200 as const };
        }
      } else {
        // Для failed/refunded обновляем без проверки текущего статуса
        await tx.payment.update({
          where: { id },
          data: { status },
        });
      }

      // Если платёж завершён успешно — записываем на курс
      if (status === "completed" && wasStatusUpdated) {
        const currentPayment = await tx.payment.findUnique({ where: { id } });
        if (currentPayment) {
          await ensureEnrollment(tx, currentPayment.userId, currentPayment.courseId);
        }
      }

      // Если платёж возвращён — отменяем запись и декрементируем studentCount
      if (status === "refunded") {
        const currentPayment = await tx.payment.findUnique({ where: { id } });
        if (currentPayment) {
          const cancelled = await tx.enrollment.updateMany({
            where: {
              userId: currentPayment.userId,
              courseId: currentPayment.courseId,
              status: "active",
            },
            data: { status: "cancelled" },
          });
          if (cancelled.count > 0) {
            await tx.course.update({
              where: { id: currentPayment.courseId },
              data: { studentCount: { decrement: 1 } },
            });
          }
        }
      }

      const updatedPayment = await tx.payment.findUnique({ where: { id } });
      return { updated: updatedPayment, wasCompleted: status === "completed" && wasStatusUpdated };
    });

    // Handle error result from transaction
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    // Send notification for completed payment
    if (result.wasCompleted && result.updated) {
      const courseData = await db.course.findUnique({
        where: { id: result.updated.courseId },
        select: { title: true },
      });
      if (courseData) {
        createNotification({
          userId: result.updated.userId,
          type: "enrollment",
          title: "Оплата прошла",
          message: `Вы записаны на курс "${courseData.title}"`,
          link: `/course/${result.updated.courseId}`,
        }).catch((err) => log.error("Failed to send payment notification", { error: err }));
      }
    }

    log.info("Payment status updated by admin", {
      paymentId: id,
      status,
      adminId: session.user.id,
    });

    return NextResponse.json(
      { message: "Статус платежа обновлён", payment: result.updated },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "payments/[id]/PUT", metadata: { paymentId: id?.toString() } });
  }
}
