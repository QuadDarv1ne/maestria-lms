import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST: Записаться на курс
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "Ошибка аутентификации" }, { status: 401 });
    }
    // Проверяем существование курса
    const course = await db.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Курс не найден" },
        { status: 404 }
      );
    }

    if (!course.isPublished) {
      return NextResponse.json(
        { error: "Курс не опубликован" },
        { status: 400 }
      );
    }

    // Проверяем, не записан ли уже пользователь
    const existingEnrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (existingEnrollment) {
      if (existingEnrollment.status === "active") {
        return NextResponse.json(
          { error: "Вы уже записаны на этот курс" },
          { status: 400 }
        );
      }
      if (existingEnrollment.status === "cancelled") {
        // Переподписка
        await db.enrollment.update({
          where: { id: existingEnrollment.id },
          data: {
            status: "active",
            progress: 0,
            enrolledAt: new Date(),
          },
        });

        // Обновляем счётчик студентов
        await db.course.update({
          where: { id: courseId },
          data: { studentCount: { increment: 1 } },
        });

        return NextResponse.json(
          { message: "Вы успешно повторно записаны на курс" },
          { status: 200 }
        );
      }
    }

    // Для бесплатных курсов — автоматическая запись
    if (course.price === 0) {
      const enrollment = await db.enrollment.create({
        data: {
          userId,
          courseId,
          status: "active",
          progress: 0,
        },
      });

      // Обновляем счётчик студентов
      await db.course.update({
        where: { id: courseId },
        data: { studentCount: { increment: 1 } },
      });

      return NextResponse.json(
        { message: "Вы успешно записаны на бесплатный курс", enrollment },
        { status: 201 }
      );
    }

    // Для платных курсов — создаём платеж
    const payment = await db.payment.create({
      data: {
        userId,
        courseId,
        amount: course.price,
        currency: course.currency,
        status: "pending",
        paymentMethod: "sbp", // по умолчанию
      },
    });

    return NextResponse.json(
      {
        message: "Для записи на платный курс необходимо оплатить",
        requiresPayment: true,
        paymentId: payment.id,
        amount: course.price,
        currency: course.currency,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Ошибка записи на курс:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
