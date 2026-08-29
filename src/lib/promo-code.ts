/**
 * Promo Code validation and calculation logic.
 *
 * Supports two discount types:
 * - "percentage": discountValue is a percentage (1-100)
 * - "fixed": discountValue is a fixed amount in the course currency
 *
 * Validation rules:
 * - Code must be active
 * - Code must be within valid date range
 * - Usage count must not exceed maxUses (if maxUses > 0)
 * - Per-user usage must not exceed maxUsesPerUser
 * - Order amount must meet minAmount threshold
 * - If courseId is set, promo code only applies to that course
 */

import { db } from "@/lib/db";
import { log } from "@/lib/logger";

export interface PromoCodeValidationResult {
  valid: boolean;
  error?: string;
  promoCode?: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    maxDiscount: number | null;
  };
  discountAmount?: number;
  finalPrice?: number;
}

/**
 * Validate a promo code and calculate the discount for a given price.
 */
export async function validatePromoCode(
  code: string,
  originalPrice: number,
  userId: string,
  courseId?: string,
): Promise<PromoCodeValidationResult> {
  const normalizedCode = code.trim().toUpperCase();

  if (!normalizedCode) {
    return { valid: false, error: "Promo code is required" };
  }

  if (originalPrice <= 0) {
    return { valid: false, error: "Promo code cannot be applied to free courses" };
  }

  const promoCode = await db.promoCode.findUnique({
    where: { code: normalizedCode },
  });

  if (!promoCode) {
    return { valid: false, error: "Promo code not found" };
  }

  // Check if active
  if (!promoCode.isActive) {
    return { valid: false, error: "Promo code is no longer active" };
  }

  // Check validity period
  const now = new Date();
  if (now < promoCode.validFrom) {
    return { valid: false, error: "Promo code is not yet valid" };
  }
  if (promoCode.validUntil && now > promoCode.validUntil) {
    return { valid: false, error: "Promo code has expired" };
  }

  // Check total usage limit
  if (promoCode.maxUses > 0 && promoCode.usedCount >= promoCode.maxUses) {
    return { valid: false, error: "Promo code usage limit reached" };
  }

  // Check per-user usage limit
  if (promoCode.maxUsesPerUser > 0) {
    const usedBy: string[] = promoCode.usedBy ? safeParseJsonArray(promoCode.usedBy) : [];
    const userUsageCount = usedBy.filter((id) => id === userId).length;
    if (userUsageCount >= promoCode.maxUsesPerUser) {
      return { valid: false, error: "You have already used this promo code" };
    }
  }

  // Check minimum amount
  if (promoCode.minAmount > 0 && originalPrice < promoCode.minAmount) {
    return {
      valid: false,
      error: `Minimum order amount for this promo code is ${promoCode.minAmount}`,
    };
  }

  // Check course restriction
  if (promoCode.courseId && promoCode.courseId !== courseId) {
    return { valid: false, error: "Promo code is not valid for this course" };
  }

  // Calculate discount
  let discountAmount: number;
  if (promoCode.discountType === "percentage") {
    discountAmount = (originalPrice * promoCode.discountValue) / 100;
    // Apply max discount cap if set
    if (promoCode.maxDiscount !== null && discountAmount > promoCode.maxDiscount) {
      discountAmount = promoCode.maxDiscount;
    }
  } else {
    // fixed discount
    discountAmount = promoCode.discountValue;
  }

  // Discount cannot exceed the original price
  discountAmount = Math.min(discountAmount, originalPrice);
  discountAmount = Math.round(discountAmount * 100) / 100; // round to 2 decimal places

  const finalPrice = Math.max(0, originalPrice - discountAmount);

  return {
    valid: true,
    promoCode: {
      id: promoCode.id,
      code: promoCode.code,
      discountType: promoCode.discountType,
      discountValue: promoCode.discountValue,
      maxDiscount: promoCode.maxDiscount,
    },
    discountAmount,
    finalPrice,
  };
}

/**
 * Mark a promo code as used by a specific user.
 * Increments the usage counter and records the user ID.
 * Uses atomic transaction to prevent race conditions across all DB providers.
 */
export async function redeemPromoCode(
  promoCodeId: string,
  userId: string,
): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      const promoCode = await tx.promoCode.findUnique({
        where: { id: promoCodeId },
        select: { usedBy: true, usedCount: true },
      });

      if (!promoCode) {
        log.warn("Promo code not found for redemption", { promoCodeId });
        return;
      }

      const usedBy: string[] = promoCode.usedBy ? safeParseJsonArray(promoCode.usedBy) : [];

      // Check if user already used this code
      if (usedBy.includes(userId)) {
        log.info("Promo code already used by this user", { promoCodeId, userId });
        return;
      }

      usedBy.push(userId);

      await tx.promoCode.update({
        where: { id: promoCodeId },
        data: {
          usedCount: promoCode.usedCount + 1,
          usedBy: JSON.stringify(usedBy),
        },
      });
    });

    log.info("Promo code redeemed", { promoCodeId, userId });
  } catch (error: unknown) {
    log.error("Failed to redeem promo code", { promoCodeId, userId, error });
  }
}

/**
 * Generate a random promo code string.
 */
export function generatePromoCode(length: number = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function safeParseJsonArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === "string");
    }
  } catch {
    // ignore
  }
  return [];
}
