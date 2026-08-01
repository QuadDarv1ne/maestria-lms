import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAdmin, adminErrorResponse, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { parsePagination } from "@/lib/utils";
import { generatePromoCode } from "@/lib/promo-code";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("admin", RATE_LIMITS.admin);

const createPromoCodeSchema = z.object({
  code: z.string().min(3).max(30).optional(),
  description: z.string().max(500).optional(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().positive(),
  minAmount: z.number().min(0).default(0),
  maxDiscount: z.number().positive().optional(),
  maxUses: z.number().int().min(0).default(0),
  maxUsesPerUser: z.number().int().min(1).default(1),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  courseId: z.string().optional(),
});

/**
 * GET /api/admin/promo-codes
 * List all promo codes with pagination.
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
    const { page, limit, skip } = parsePagination(searchParams, { defaultLimit: 20, maxLimit: 100 });

    const [promoCodes, total] = await Promise.all([
      db.promoCode.findMany({
        include: {
          course: {
            select: { id: true, title: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.promoCode.count(),
    ]);

    return NextResponse.json({
      promoCodes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/promo-codes GET" });
  }
}

/**
 * POST /api/admin/promo-codes
 * Create a new promo code.
 */
export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAdmin(session)) {
      if (!session) return authErrorResponse();
      return adminErrorResponse();
    }

    const body = await request.json();
    const validation = createPromoCodeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Validation error" },
        { status: 400 },
      );
    }

    const data = validation.data;

    // Generate code if not provided
    const code = (data.code || generatePromoCode(8)).toUpperCase();

    // Check uniqueness
    const existing = await db.promoCode.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { error: "Promo code already exists" },
        { status: 409 },
      );
    }

    // Validate percentage range
    if (data.discountType === "percentage" && data.discountValue > 100) {
      return NextResponse.json(
        { error: "Percentage discount cannot exceed 100%" },
        { status: 400 },
      );
    }

    const promoCode = await db.promoCode.create({
      data: {
        code,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minAmount: data.minAmount,
        maxDiscount: data.maxDiscount ?? null,
        maxUses: data.maxUses,
        maxUsesPerUser: data.maxUsesPerUser,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        isActive: data.isActive,
        courseId: data.courseId || null,
      },
    });

    return NextResponse.json({ promoCode }, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/promo-codes POST" });
  }
}
