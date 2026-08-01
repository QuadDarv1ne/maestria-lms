import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { validatePromoCode } from "@/lib/promo-code";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const validateSchema = z.object({
  code: z.string().min(1, "Promo code is required"),
  courseId: z.string().min(1, "Course ID is required"),
});

const checkRateLimit = rateLimit("default", RATE_LIMITS.default);

/**
 * POST /api/payments/promo/validate
 * Validates a promo code and returns the discount amount.
 */
export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const body = await request.json();
    const validation = validateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Validation error" },
        { status: 400 },
      );
    }

    const { code, courseId } = validation.data;
    const userId = session.user.id;

    // Get course price
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { price: true, isPublished: true },
    });

    if (!course || !course.isPublished) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 },
      );
    }

    if (course.price === 0) {
      return NextResponse.json(
        { error: "Promo codes cannot be applied to free courses" },
        { status: 400 },
      );
    }

    const result = await validatePromoCode(code, course.price, userId, courseId);

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: result.error },
        { status: 200 },
      );
    }

    return NextResponse.json({
      valid: true,
      promoCode: result.promoCode,
      originalPrice: course.price,
      discountAmount: result.discountAmount,
      finalPrice: result.finalPrice,
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "promo/validate POST" });
  }
}
