import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions, ExtendedSession } from "@/lib/auth";

// GET: Статус платежа
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = (await getServerSession(authOptions)) as ExtendedSession | null;

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

// PUT: Обновить статус платежа (только для администраторов).
// Обычные пользователи не могут менять статус платежа — это предотвращает
// ситуацию, когда пользователь сам одобряет свой платёж и получает бесплатный доступ.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = (await getServerSession(authOptions)) as ExtendedSession | null;
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
    const { status } = body;

    if (!["completed", "failed", "refunded"].includes(status)) {
      return NextResponse.json(
        { error: "Неверный статус платежа" },
        { status: 400 }
      );
    }

    // Атомарное обновление: статус платежа + запись на курс
    const updatedPayment = await db.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: { status },
      });

      // Если платёж завершён успешно — записываем на курс
      if (status === "completed" && payment.status === "pending") {
        const existingEnrollment = await tx.enrollment.findUnique({
          where: {
            userId_courseId: {
              userId: payment.userId,
              courseId: payment.courseId,
            },
          },
        });

        if (!existingEnrollment) {
          await tx.enrollment.create({
            data: {
              userId: payment.userId,
              courseId: payment.courseId,
              status: "active",
              progress: 0,
            },
          });
          await tx.course.update({
            where: { id: payment.courseId },
            data: { studentCount: { increment: 1 } },
          });
        } else if (existingEnrollment.status !== "active") {
          await tx.enrollment.update({
            where: { id: existingEnrollment.id },
            data: {
              status: "active",
              progress: 0,
              enrolledAt: new Date(),
            },
          });
        }
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

      return updated;
    });

    return NextResponse.json(
      { message: "Статус платежа обновлён", payment: updatedPayment },
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
