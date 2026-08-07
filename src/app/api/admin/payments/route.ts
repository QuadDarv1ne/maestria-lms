import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAdmin, adminErrorResponse, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { parsePagination } from "@/lib/utils";
import { validateQuery } from "@/lib/request-validation";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("admin", RATE_LIMITS.admin);

const listPaymentsSchema = z.object({
  status: z
    .enum(["pending", "completed", "failed", "refunded", "cancelled"])
    .optional(),
  userId: z.string().uuid().optional(),
  courseId: z.string().optional(),
  search: z.string().max(100).optional(),
});

/**
 * GET /api/admin/payments
 * List payments with optional filters and pagination (admin only).
 */
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAdmin(session)) {
      if (!session) return authErrorResponse();
      return adminErrorResponse();
    }

    const { searchParams } = new URL(request.url);
    const queryCheck = validateQuery(searchParams, listPaymentsSchema);
    if ("response" in queryCheck) return queryCheck.response;
    const { status, userId, courseId, search } = queryCheck.data;
    const { page, limit, skip } = parsePagination(searchParams, { defaultLimit: 20, maxLimit: 100 });

    const where = {
      ...(status ? { status } : {}),
      ...(userId ? { userId } : {}),
      ...(courseId ? { courseId } : {}),
      ...(search
        ? {
            OR: [
              { transactionId: { contains: search } },
              { user: { email: { contains: search } } },
              { user: { name: { contains: search } } },
              { course: { title: { contains: search } } },
            ],
          }
        : {}),
    };

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          course: { select: { id: true, title: true } },
          promoCode: { select: { id: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.payment.count({ where }),
    ]);

    const totalRevenue = await db.payment.aggregate({
      where: { status: "completed" },
      _sum: { amount: true },
    });

    return NextResponse.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalRevenue: totalRevenue._sum.amount ?? 0,
        completedPayments: await db.payment.count({ where: { status: "completed" } }),
        refundedPayments: await db.payment.count({ where: { status: "refunded" } }),
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/payments GET" });
  }
}