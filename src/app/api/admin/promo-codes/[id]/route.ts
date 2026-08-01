import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAdmin, adminErrorResponse, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("admin", RATE_LIMITS.admin);

const updatePromoCodeSchema = z.object({
  description: z.string().max(500).optional(),
  discountType: z.enum(["percentage", "fixed"]).optional(),
  discountValue: z.number().positive().optional(),
  minAmount: z.number().min(0).optional(),
  maxDiscount: z.number().positive().nullable().optional(),
  maxUses: z.number().int().min(0).optional(),
  maxUsesPerUser: z.number().int().min(1).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  courseId: z.string().nullable().optional(),
});

/**
 * GET /api/admin/promo-codes/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAdmin(session)) {
      if (!session) return authErrorResponse();
      return adminErrorResponse();
    }

    const { id } = await params;

    const promoCode = await db.promoCode.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true } },
      },
    });

    if (!promoCode) {
      return NextResponse.json({ error: "Promo code not found" }, { status: 404 });
    }

    return NextResponse.json({ promoCode });
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/promo-codes/[id] GET" });
  }
}

/**
 * PATCH /api/admin/promo-codes/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAdmin(session)) {
      if (!session) return authErrorResponse();
      return adminErrorResponse();
    }

    const { id } = await params;
    const body = await request.json();
    const validation = updatePromoCodeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Validation error" },
        { status: 400 },
      );
    }

    const data = validation.data;

    // Validate percentage range
    if (data.discountType === "percentage" && data.discountValue && data.discountValue > 100) {
      return NextResponse.json(
        { error: "Percentage discount cannot exceed 100%" },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (data.description !== undefined) updateData.description = data.description;
    if (data.discountType !== undefined) updateData.discountType = data.discountType;
    if (data.discountValue !== undefined) updateData.discountValue = data.discountValue;
    if (data.minAmount !== undefined) updateData.minAmount = data.minAmount;
    if (data.maxDiscount !== undefined) updateData.maxDiscount = data.maxDiscount;
    if (data.maxUses !== undefined) updateData.maxUses = data.maxUses;
    if (data.maxUsesPerUser !== undefined) updateData.maxUsesPerUser = data.maxUsesPerUser;
    if (data.validFrom !== undefined) updateData.validFrom = new Date(data.validFrom);
    if (data.validUntil !== undefined) updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.courseId !== undefined) updateData.courseId = data.courseId || null;

    const promoCode = await db.promoCode.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ promoCode });
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/promo-codes/[id] PATCH" });
  }
}

/**
 * DELETE /api/admin/promo-codes/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAdmin(session)) {
      if (!session) return authErrorResponse();
      return adminErrorResponse();
    }

    const { id } = await params;

    // Check if promo code has been used
    const promoCode = await db.promoCode.findUnique({
      where: { id },
      select: { usedCount: true },
    });

    if (!promoCode) {
      return NextResponse.json({ error: "Promo code not found" }, { status: 404 });
    }

    // If used, deactivate instead of delete to preserve payment history
    if (promoCode.usedCount > 0) {
      await db.promoCode.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ message: "Promo code deactivated (already used)" });
    }

    await db.promoCode.delete({ where: { id } });
    return NextResponse.json({ message: "Promo code deleted" });
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/promo-codes/[id] DELETE" });
  }
}
