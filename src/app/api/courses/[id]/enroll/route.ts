import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("enrollment", RATE_LIMITS.enrollment);

const paymentMethodSchema = z
  .enum(["card", "sbp", "yookassa", "tinkoff"])
  .default("sbp");

// POST: Записаться на курс
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const { id: courseId } = await params;

    const session = await getAuthSession();

    const authError = requireAuth(session);
    if (authError) return authError;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Невалидная сессия" }, { status: 401 });
    }

    const userId = session.user.id;
    // Course ID may be a UUID or slug — try both
    const course = await db.course.findFirst({
      where: { OR: [{ id: courseId }, { slug: courseId }] },
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

    // Проверяем видимость курса
    if (course.visibility === "private") {
      // Приватные курсы доступны только по приглашению (через админку)
      return NextResponse.json(
        { error: "Запись на этот курс доступна только по приглашению" },
        { status: 403 }
      );
    }

    // Проверяем дату начала курса
    if (course.startDate && new Date() < new Date(course.startDate)) {
      return NextResponse.json(
        { error: `Запись на курс откроется ${new Date(course.startDate).toLocaleDateString("ru-RU")}` },
        { status: 400 }
      );
    }

    // Проверяем дату окончания курса
    if (course.endDate && new Date() > new Date(course.endDate)) {
      return NextResponse.json(
        { error: "Запись на курс закрыта" },
        { status: 400 }
      );
    }

    // Проверяем пререквизиты (outside transaction - read-only check)
    let missingPrereqs: { id: string; title: string }[] = [];
    if (course.prerequisites) {
      try {
        const prerequisites: string[] = JSON.parse(course.prerequisites);
        if (prerequisites.length > 0) {
          // Fetch all enrollments to check which prerequisites are completed
          const completedEnrollments = await db.enrollment.findMany({
            where: {
              userId,
              courseId: { in: prerequisites },
              status: "completed",
            },
            select: { courseId: true },
          });

          const completedCourseIds = new Set(completedEnrollments.map(e => e.courseId));
          const missingIds = prerequisites.filter(id => !completedCourseIds.has(id));

          if (missingIds.length > 0) {
            // Fetch missing course details for better error message
            const missingCourses = await db.course.findMany({
              where: { id: { in: missingIds } },
              select: { id: true, title: true },
            });
            missingPrereqs = missingCourses.map(c => ({ id: c.id, title: c.title }));
          }
        }
      } catch {
        log.warn("Malformed prerequisites JSON, skipping prerequisite check", { courseId: course.id });
      }
    }

    if (missingPrereqs.length > 0) {
      return NextResponse.json(
        {
          error: "Необходимо сначала пройти курсы-пререквизиты",
          missingPrerequisites: missingPrereqs,
        },
        { status: 400 }
      );
    }

    // Use resolved course.id for all DB operations (courseId param could be a slug)
    const resolvedCourseId = course.id;

    // Read optional paymentMethod from request body
    let paymentMethod = "sbp";
    try {
      const body = await request.json();
      const parsed = paymentMethodSchema.safeParse(body?.paymentMethod);
      if (parsed.success) {
        paymentMethod = parsed.data;
      }
    } catch (err: unknown) {
      log.warn("Malformed request body for enroll, using default payment method", { error: err });
    }

    const result = await db.$transaction(async (tx) => {
      // Сначала проверяем дубликат — ДО изменения studentCount
      const existingEnrollment = await tx.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId: resolvedCourseId,
          },
        },
      });

      if (existingEnrollment) {
        if (existingEnrollment.status === "active") {
          return { error: "Вы уже записаны на этот курс", status: 400 as const };
        }
        if (existingEnrollment.status === "cancelled") {
          if (course.price === 0 && course.maxStudents && course.maxStudents > 0) {
            const canReenroll = await tx.course.updateMany({
              where: {
                id: resolvedCourseId,
                studentCount: { lt: course.maxStudents },
              },
              data: { studentCount: { increment: 1 } },
            });
            if (canReenroll.count === 0) {
              return { error: "Достигнут лимит студентов на курсе", status: 400 as const };
            }
          } else if (course.price === 0) {
            await tx.course.update({
              where: { id: resolvedCourseId },
              data: { studentCount: { increment: 1 } },
            });
          }
          await tx.enrollment.update({
            where: { id: existingEnrollment.id },
            data: {
              status: "active",
              progress: 0,
              enrolledAt: new Date(),
            },
          });
          return { message: "Вы успешно повторно записаны на курс", status: 200 as const };
        }
        if (existingEnrollment.status === "completed") {
          return { error: "Вы уже завершили этот курс", status: 400 as const };
        }
      }

      // Для бесплатных курсов: проверяем лимит и создаём запись
      if (course.price === 0) {
        if (course.maxStudents && course.maxStudents > 0) {
          const incremented = await tx.course.updateMany({
            where: {
              id: resolvedCourseId,
              studentCount: { lt: course.maxStudents },
            },
            data: { studentCount: { increment: 1 } },
          });
          if (incremented.count === 0) {
            return { error: "Достигнут лимит студентов на курсе", status: 400 as const };
          }
        } else {
          // Курс без лимита — всегда увеличиваем счётчик
          await tx.course.update({
            where: { id: resolvedCourseId },
            data: { studentCount: { increment: 1 } },
          });
        }

        const enrollment = await tx.enrollment.create({
          data: {
            userId,
            courseId: resolvedCourseId,
            status: "active",
            progress: 0,
          },
        });
        return {
          message: "Вы успешно записаны на бесплатный курс",
          enrollment,
          status: 201 as const,
        };
      }

      // Для платных курсов — создаём платёж без увеличения studentCount
      const payment = await tx.payment.create({
        data: {
          userId,
          courseId: resolvedCourseId,
          amount: course.price,
          currency: course.currency,
          status: "pending",
          paymentMethod,
        },
      });

      return {
        message: "Для записи на платный курс необходимо оплатить",
        requiresPayment: true,
        paymentId: payment.id,
        amount: course.price,
        currency: course.currency,
        status: 200 as const,
      };
    });

    // Return response based on transaction result
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    // Send server notification for successful enrollment
    if (course.price === 0) {
      await createNotification({
        userId,
        type: "enrollment",
        title: "Новый курс",
        message: `Вы записаны на курс "${course.title}"`,
        link: `/course/${resolvedCourseId}`,
      }).catch((err) => log.error("Failed to send enrollment notification", { error: err }));
    }

    const { status, ...responseData } = result;
    return NextResponse.json(responseData, { status });
  } catch (error: unknown) {
    return handleApiError(error, { route: "courses/[id]/enroll" });
  }
}
