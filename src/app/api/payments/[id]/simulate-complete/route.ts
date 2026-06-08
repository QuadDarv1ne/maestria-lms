import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("paymentUpdate", RATE_LIMITS.paymentUpdate);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const { id } = await params;
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Необходимо авторизоваться" }, { status: 401 });
    }

    if (env.isDevelopment) {
      // In development, any authenticated user can simulate
    } else if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const payment = await db.payment.findUnique({ where: { id } });

    if (!payment) {
      return NextResponse.json({ error: "Платёж не найден" }, { status: 404 });
    }

    if (payment.userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    if (payment.status !== "pending") {
      return NextResponse.json({ error: "Платёж уже обработан" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const updateResult = await tx.payment.updateMany({
        where: { id, status: "pending" },
        data: {
          status: "completed",
          transactionId: `sim_${Date.now()}`,
          updatedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        return { alreadyCompleted: true };
      }

      await tx.course.updateMany({
        where: { id: payment.courseId },
        data: { studentCount: { increment: 1 } },
      });

      await tx.enrollment.upsert({
        where: {
          userId_courseId: {
            userId: payment.userId,
            courseId: payment.courseId,
          },
        },
        create: {
          userId: payment.userId,
          courseId: payment.courseId,
          status: "active",
          progress: 0,
        },
        update: {
          status: "active",
        },
      });

      return { alreadyCompleted: false };
    });

    if (result.alreadyCompleted) {
      return NextResponse.json({ error: "Платёж уже обработан" }, { status: 400 });
    }

    log.info("Payment simulated complete", {
      paymentId: id,
      userId: session.user.id,
      environment: env.isDevelopment ? "development" : "production",
    });

    return NextResponse.json({ message: "Платёж успешно завершён (тестовый режим)" });
  } catch (error: unknown) {
    return handleApiError(error, { route: "payments/[id]/simulate-complete" });
  }
}
