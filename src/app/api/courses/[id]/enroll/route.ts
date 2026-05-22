import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("enrollment", RATE_LIMITS.enrollment);

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

    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    // Проверяем существование курса (по ID или slug)
    const courseIdNum = parseInt(courseId, 10);
    const course = await db.course.findFirst({
      where: isNaN(courseIdNum) ? { slug: courseId } : { id: courseId },
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

    // Проверяем максимальное количество студентов
    if (course.maxStudents && course.maxStudents > 0) {
      if (course.studentCount >= course.maxStudents) {
        return NextResponse.json(
          { error: "Достигнут лимит студентов на курсе" },
          { status: 400 }
        );
      }
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
        // Если не удалось распарсить пререквизиты, пропускаем проверку
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
      if (body?.paymentMethod) {
        paymentMethod = body.paymentMethod;
      }
    } catch { /* no body or invalid JSON — use default */ }

    // Wrap enrollment logic in a transaction to prevent race conditions
    // when a user sends multiple concurrent requests.
    const result = await db.$transaction(async (tx) => {
      // Проверяем, не записан ли уже пользователь (inside transaction for atomicity)
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
          // Переподписка
          await tx.enrollment.update({
            where: { id: existingEnrollment.id },
            data: {
              status: "active",
              progress: 0,
              enrolledAt: new Date(),
            },
          });

          // Обновляем счётчик студентов
          await tx.course.update({
            where: { id: resolvedCourseId },
            data: { studentCount: { increment: 1 } },
          });

          return { message: "Вы успешно повторно записаны на курс", status: 200 as const };
        }
      }

      // Для бесплатных курсов — автоматическая запись
      if (course.price === 0) {
        const enrollment = await tx.enrollment.create({
          data: {
            userId,
            courseId: resolvedCourseId,
            status: "active",
            progress: 0,
          },
        });

        // Обновляем счётчик студентов
        await tx.course.update({
          where: { id: resolvedCourseId },
          data: { studentCount: { increment: 1 } },
        });

        return {
          message: "Вы успешно записаны на бесплатный курс",
          enrollment,
          status: 201 as const,
        };
      }

      // Для платных курсов — создаём платеж
      const payment = await tx.payment.create({
        data: {
          userId,
          courseId: resolvedCourseId,
          amount: course.price,
          currency: course.currency,
          status: "pending",
          paymentMethod, // from request body, defaults to 'sbp'
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
        link: `course/${resolvedCourseId}`,
      }).catch((err) => log.error("Failed to send enrollment notification", { error: err }));
    }

    const { status, ...responseData } = result;
    return NextResponse.json(responseData, { status });
  } catch (error) {
    return handleApiError(error, { route: "courses/[id]/enroll" });
  }
}
