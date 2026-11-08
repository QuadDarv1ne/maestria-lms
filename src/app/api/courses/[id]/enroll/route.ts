import { NextRequest, NextResponse } from "next/server";
import { db, Prisma } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { dispatchEmail } from "@/lib/email-dispatch";
import { enrollmentNotificationEmail } from "@/lib/emails";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { validatePromoCode, redeemPromoCode } from "@/lib/promo-code";
import { resolveProviderAndMethod } from "@/lib/payments/service";
import { validateParams, idOrSlugSchema } from "@/lib/request-validation";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("enrollment", RATE_LIMITS.enrollment);

const paymentMethodSchema = z
  .enum(["card", "sbp", "yookassa", "tinkoff"])
  .default("sbp");

/** True while the course still has room. Courses without a limit are always open. */
function hasFreeSeat(maxStudents: number | null, studentCount: number): boolean {
  return !maxStudents || maxStudents <= 0 || studentCount < maxStudents;
}

/**
 * Claim a seat, atomically. The `studentCount < maxStudents` guard lives in the
 * UPDATE itself, so two concurrent enrollments cannot both pass a read-then-write
 * check and push the counter past the limit. Returns false when the course is full.
 */
async function takeSeat(
  tx: Prisma.TransactionClient,
  courseId: string,
  maxStudents: number | null,
): Promise<boolean> {
  if (maxStudents && maxStudents > 0) {
    const updated = await tx.course.updateMany({
      where: { id: courseId, studentCount: { lt: maxStudents } },
      data: { studentCount: { increment: 1 } },
    });
    return updated.count > 0;
  }
  await tx.course.update({
    where: { id: courseId },
    data: { studentCount: { increment: 1 } },
  });
  return true;
}

const SEAT_LIMIT_ERROR = "Достигнут лимит студентов на курсе";

/**
 * Return an existing pending payment for this user+course (if any), or null.
 * Without this guard every retried checkout added a fresh pending row for the
 * same user+course, so the user ended up with several unpaid attempts and the
 * payment page could confirm a row the client never rendered.
 */
async function reusePendingPayment(tx: Prisma.TransactionClient, userId: string, courseId: string) {
  return tx.payment.findFirst({
    where: { userId, courseId, status: "pending" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      amount: true,
      currency: true,
      paymentMethod: true,
      paymentProvider: true,
    },
  });
}

/**
 * Percentage of completed lessons recomputed from the Progress rows.
 * Re-enrollment must not reset the counter to 0: the Progress rows were kept
 * while the enrollment was cancelled, and the next completed lesson triggers a
 * recount from them — a hard 0 made the visible progress jump backwards.
 */
async function recomputeProgress(
  tx: Prisma.TransactionClient,
  userId: string,
  courseId: string,
): Promise<number> {
  const [totalLessons, completedLessons] = await Promise.all([
    tx.lesson.count({ where: { module: { courseId } } }),
    tx.progress.count({
      where: { userId, lesson: { module: { courseId } }, completed: true },
    }),
  ]);
  return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
}
// POST: Записаться на курс
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const { id: courseId } = await params;
    const paramCheck = validateParams({ id: courseId }, z.object({ id: idOrSlugSchema }));
    if ("response" in paramCheck) return paramCheck.response;

    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

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
        { error: `Запись на курс откроется ${formatDate(course.startDate)}` },
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

          const completedCourseIds = new Set(completedEnrollments.map((e: { courseId: string }) => e.courseId));
          const missingIds = prerequisites.filter(id => !completedCourseIds.has(id));

          if (missingIds.length > 0) {
            // Fetch missing course details for better error message
            const missingCourses = await db.course.findMany({
              where: { id: { in: missingIds } },
              select: { id: true, title: true },
            });
            missingPrereqs = missingCourses.map((c: { id: string; title: string }) => ({ id: c.id, title: c.title }));
          }
        }
      } catch (e: unknown) {
        log.error("Malformed prerequisites JSON — blocking enrollment", { courseId: course.id, error: e });
        return NextResponse.json(
          { error: "Ошибка в конфигурации курса. Обратитесь к администратору." },
          { status: 500 }
        );
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

    // Read optional payment selection and promoCode from the request body.
    // Legacy clients send `paymentMethod` (sbp/card/yookassa/tinkoff); the new
    // checkout sends `provider` + `method` (CARD/SBP/YOOMONEY/...).
    let legacyMethod: string | undefined;
    let providerInput: string | undefined;
    let methodInput: string | undefined;
    let promoCodeInput: string | undefined;
    try {
      const body = await request.json();
      const parsed = paymentMethodSchema.safeParse(body?.paymentMethod);
      if (parsed.success) legacyMethod = parsed.data;
      if (typeof body?.provider === "string" && body.provider.trim()) providerInput = body.provider;
      if (typeof body?.method === "string" && body.method.trim()) methodInput = body.method;
      if (typeof body?.promoCode === "string" && body.promoCode.trim().length > 0) {
        promoCodeInput = body.promoCode;
      }
    } catch (err: unknown) {
      log.warn("Malformed request body for enroll, using default payment method", { error: err });
    }

    const resolvedPayment = resolveProviderAndMethod({
      provider: providerInput ?? null,
      method: methodInput ?? null,
      legacyPaymentMethod: legacyMethod ?? "sbp",
    });
    const paymentProvider = "error" in resolvedPayment ? "YOOKASSA" : resolvedPayment.provider;
    const paymentMethod = ("error" in resolvedPayment ? "SBP" : resolvedPayment.method).toLowerCase();

    // Validate promo code if provided (paid courses only)
    let promoResult: Awaited<ReturnType<typeof validatePromoCode>> | null = null;
    let finalAmount = course.price;
    let discountAmount = 0;
    let promoCodeId: string | null = null;

    if (promoCodeInput) {
      promoResult = await validatePromoCode(promoCodeInput, course.price, userId, resolvedCourseId);
      if (!promoResult.valid) {
        return NextResponse.json(
          { error: promoResult.error },
          { status: 400 }
        );
      }
      finalAmount = promoResult.finalPrice ?? course.price;
      discountAmount = promoResult.discountAmount ?? 0;
      promoCodeId = promoResult.promoCode?.id ?? null;
    }

    // Re-fetch course inside transaction to ensure data consistency
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Re-fetch course inside transaction to avoid stale data
      const txCourse = await tx.course.findUnique({
        where: { id: resolvedCourseId },
      });
      
      if (!txCourse) {
        return { error: "Курс не найден", status: 404 as const };
      }

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
          if (txCourse.price > 0 && finalAmount > 0) {
            // Платный курс: место не занимаем — счётчик увеличивает завершение
            // платежа (completePayment / simulate-complete). Здесь лишь
            // отбиваем заведомо переполненный курс, чтобы не выставлять счёт
            // провайдера за место, которого нет.
            if (!hasFreeSeat(txCourse.maxStudents, txCourse.studentCount)) {
              return { error: SEAT_LIMIT_ERROR, status: 400 as const };
            }
            // Промокод не погашаем — это делает completePayment, когда деньги
            // действительно поступили; отменённый pending не сжигает попытку.
            // Повторный клик не должен плодить pending-платежи: отдаём
            // существующий, если он ещё не истёк.
            const reused = await reusePendingPayment(tx, userId, resolvedCourseId);
            if (reused) {
              return {
                message: "У вас уже есть ожидающий платёж",
                requiresPayment: true,
                paymentId: reused.id,
                paymentProvider: reused.paymentProvider ?? paymentProvider,
                paymentMethod: reused.paymentMethod ?? paymentMethod,
                amount: reused.amount,
                currency: reused.currency,
                existing: true,
                status: 200 as const,
              };
            }
            const payment = await tx.payment.create({
              data: {
                userId,
                courseId: resolvedCourseId,
                amount: finalAmount,
                discountAmount,
                promoCodeId,
                currency: txCourse.currency,
                status: "pending",
                paymentMethod,
                paymentProvider,
              },
            });
            return {
              message: "Для повторной записи на платный курс необходимо оплатить",
              requiresPayment: true,
              paymentId: payment.id,
              paymentProvider,
              paymentMethod,
              amount: finalAmount,
              currency: txCourse.currency,
              status: 200 as const,
            };
          }
          // Бесплатный курс (или полная скидка): занимаем место и активируем
          // запись. Прогресс не обнуляем — строки Progress остаются, и сброс
          // enrollment.progress ронял процент до первого завершённого урока.
          if (!(await takeSeat(tx, resolvedCourseId, txCourse.maxStudents))) {
            return { error: SEAT_LIMIT_ERROR, status: 400 as const };
          }
          const restoredProgress = await recomputeProgress(
            tx,
            userId,
            resolvedCourseId,
          );
          await tx.enrollment.update({
            where: { id: existingEnrollment.id },
            data: {
              status: "active",
              progress: restoredProgress,
              completedAt: null,
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
      if (txCourse.price === 0) {
        if (!(await takeSeat(tx, resolvedCourseId, txCourse.maxStudents))) {
          return { error: SEAT_LIMIT_ERROR, status: 400 as const };
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

      // Полная скидка: доступ выдаём сразу. Платёж на 0 создавать нельзя —
      // провайдер его отклоняет, и пользователь оставался бы без доступа и
      // без способа его получить.
      if (finalAmount === 0) {
        if (!(await takeSeat(tx, resolvedCourseId, txCourse.maxStudents))) {
          return { error: SEAT_LIMIT_ERROR, status: 400 as const };
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
          message: "Вы успешно записаны на курс по промокоду",
          enrollment,
          status: 201 as const,
        };
      }

      // Для платных курсов — создаём платёж без увеличения studentCount
      // (сначала переиспользуем незакрытый pending того же пользователя)
      const reused = await reusePendingPayment(tx, userId, resolvedCourseId);
      if (reused) {
        return {
          message: "У вас уже есть ожидающий платёж",
          requiresPayment: true,
          paymentId: reused.id,
          paymentProvider: reused.paymentProvider ?? paymentProvider,
          paymentMethod: reused.paymentMethod ?? paymentMethod,
          amount: reused.amount,
          currency: reused.currency,
          existing: true,
          status: 200 as const,
        };
      }

      const payment = await tx.payment.create({
        data: {
          userId,
          courseId: resolvedCourseId,
          amount: finalAmount,
          discountAmount,
          promoCodeId,
          currency: txCourse.currency,
          status: "pending",
          paymentMethod,
          paymentProvider,
        },
      });

      return {
        message: "Для записи на платный курс необходимо оплатить",
        requiresPayment: true,
        paymentId: payment.id,
        paymentProvider,
        paymentMethod,
        amount: finalAmount,
        currency: txCourse.currency,
        status: 200 as const,
      };
    });

    // Return early on transaction failure — promo code must not burn on
    // rejected requests ("already enrolled", seat limit, etc.).
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    // Redeem promo code after any path that grants INSTANT access (free
    // enrollment, full-discount enrollment, or re-enrollment).  Paid paths
    // (requiresPayment: true) redeem in completePayment() so a cancelled
    // pending payment never burns the user's attempt.
    if (promoCodeId && !("requiresPayment" in result && result.requiresPayment)) {
      await redeemPromoCode(promoCodeId, userId).catch((err: unknown) =>
        log.error("Promo code redemption failed", {
          promoCodeId, userId, error: String(err),
        }),
      );
    }

    // Send server notification for successful enrollment (free courses and
    // full-discount enrollments).  Paid paths with requiresPayment have no
    // enrollment row yet so there is nothing to notify about.
    const grantsInstantAccess = !("requiresPayment" in result && result.requiresPayment);
    if (grantsInstantAccess) {
      await createNotification({
        userId,
        type: "enrollment",
        title: "Новый курс",
        message: `Вы записаны на курс "${course.title}"`,
        link: `/course/${resolvedCourseId}`,
      }).catch((err: unknown) => log.error("Failed to send enrollment notification", { error: err }));

      // Notify the course teacher about the new student (email only if configured)
      if (course.teacherId) {
        try {
          const teacher = await db.user.findUnique({
            where: { id: course.teacherId },
            select: { email: true, name: true, emailVerified: true },
          });
          if (teacher?.email && teacher.emailVerified) {
            await dispatchEmail({
              to: teacher.email,
              ...enrollmentNotificationEmail(
                teacher.name || "преподаватель",
                session.user.name || "Студент",
                course.title,
                `${env.siteUrl}/teacher/courses/${resolvedCourseId}`
              ),
            });
          }
        } catch (err: unknown) {
          log.error("Failed to send teacher enrollment email", { error: err });
        }
      }
    }

    const { status, ...responseData } = result;
    return NextResponse.json(responseData, { status });
  } catch (error: unknown) {
    return handleApiError(error, { route: "courses/[id]/enroll" });
  }
}
