/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted, so use vi.hoisted() for mock variables
const { mockPromoCodeFindUnique, mockPromoCodeUpdate, mockTxFindUnique, mockTxUpdate } = vi.hoisted(() => ({
  mockPromoCodeFindUnique: vi.fn(),
  mockPromoCodeUpdate: vi.fn(),
  mockTxFindUnique: vi.fn(),
  mockTxUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    promoCode: {
      findUnique: mockPromoCodeFindUnique,
      update: mockPromoCodeUpdate,
    },
    $transaction: vi.fn(async (cb: (tx: Record<string, unknown>) => Promise<void>) => {
      const tx = {
        promoCode: {
          findUnique: mockTxFindUnique,
          update: mockTxUpdate,
        },
      };
      return cb(tx);
    }),
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { validatePromoCode, redeemPromoCode, generatePromoCode } from "@/lib/promo-code";

describe("Promo Code System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validatePromoCode", () => {
    it("should reject empty code", async () => {
      const result = await validatePromoCode("", 1000, "user-1", "course-1");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Promo code is required");
    });

    it("should reject for free courses (price <= 0)", async () => {
      const result = await validatePromoCode("SAVE10", 0, "user-1", "course-1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("free courses");
    });

    it("should reject non-existent code", async () => {
      mockPromoCodeFindUnique.mockResolvedValue(null);
      const result = await validatePromoCode("NONEXIST", 1000, "user-1", "course-1");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Promo code not found");
    });

    it("should reject inactive code", async () => {
      mockPromoCodeFindUnique.mockResolvedValue({
        id: "pc-1",
        code: "INACTIVE",
        isActive: false,
        validFrom: new Date("2020-01-01"),
        validUntil: null,
        maxUses: 0,
        usedCount: 0,
        maxUsesPerUser: 1,
        usedBy: null,
        minAmount: 0,
        courseId: null,
        discountType: "percentage",
        discountValue: 10,
        maxDiscount: null,
      });
      const result = await validatePromoCode("INACTIVE", 1000, "user-1", "course-1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("no longer active");
    });

    it("should reject expired code", async () => {
      mockPromoCodeFindUnique.mockResolvedValue({
        id: "pc-1",
        code: "EXPIRED",
        isActive: true,
        validFrom: new Date("2020-01-01"),
        validUntil: new Date("2020-12-31"),
        maxUses: 0,
        usedCount: 0,
        maxUsesPerUser: 1,
        usedBy: null,
        minAmount: 0,
        courseId: null,
        discountType: "percentage",
        discountValue: 10,
        maxDiscount: null,
      });
      const result = await validatePromoCode("EXPIRED", 1000, "user-1", "course-1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("should reject when usage limit reached", async () => {
      mockPromoCodeFindUnique.mockResolvedValue({
        id: "pc-1",
        code: "LIMIT10",
        isActive: true,
        validFrom: new Date("2020-01-01"),
        validUntil: null,
        maxUses: 100,
        usedCount: 100,
        maxUsesPerUser: 1,
        usedBy: null,
        minAmount: 0,
        courseId: null,
        discountType: "percentage",
        discountValue: 10,
        maxDiscount: null,
      });
      const result = await validatePromoCode("LIMIT10", 1000, "user-1", "course-1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("usage limit reached");
    });

    it("should reject when user already used the code", async () => {
      mockPromoCodeFindUnique.mockResolvedValue({
        id: "pc-1",
        code: "USED1",
        isActive: true,
        validFrom: new Date("2020-01-01"),
        validUntil: null,
        maxUses: 0,
        usedCount: 1,
        maxUsesPerUser: 1,
        usedBy: JSON.stringify(["user-1"]),
        minAmount: 0,
        courseId: null,
        discountType: "percentage",
        discountValue: 10,
        maxDiscount: null,
      });
      const result = await validatePromoCode("USED1", 1000, "user-1", "course-1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("already used");
    });

    it("should reject when minimum amount not met", async () => {
      mockPromoCodeFindUnique.mockResolvedValue({
        id: "pc-1",
        code: "MIN500",
        isActive: true,
        validFrom: new Date("2020-01-01"),
        validUntil: null,
        maxUses: 0,
        usedCount: 0,
        maxUsesPerUser: 1,
        usedBy: null,
        minAmount: 500,
        courseId: null,
        discountType: "fixed",
        discountValue: 100,
        maxDiscount: null,
      });
      const result = await validatePromoCode("MIN500", 300, "user-1", "course-1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Minimum order amount");
    });

    it("should reject when course does not match", async () => {
      mockPromoCodeFindUnique.mockResolvedValue({
        id: "pc-1",
        code: "COURSE1",
        isActive: true,
        validFrom: new Date("2020-01-01"),
        validUntil: null,
        maxUses: 0,
        usedCount: 0,
        maxUsesPerUser: 1,
        usedBy: null,
        minAmount: 0,
        courseId: "course-A",
        discountType: "percentage",
        discountValue: 20,
        maxDiscount: null,
      });
      const result = await validatePromoCode("COURSE1", 1000, "user-1", "course-B");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not valid for this course");
    });

    it("should reject a course-restricted code when courseId is missing", async () => {
      mockPromoCodeFindUnique.mockResolvedValue({
        id: "pc-course",
        code: "COURSE1",
        isActive: true,
        validFrom: new Date("2020-01-01"),
        validUntil: null,
        maxUses: 0,
        usedCount: 0,
        maxUsesPerUser: 1,
        usedBy: null,
        minAmount: 0,
        courseId: "course-A",
        discountType: "percentage",
        discountValue: 20,
        maxDiscount: null,
      });
      const result = await validatePromoCode("COURSE1", 1000, "user-1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not valid for this course");
    });

    it("should accept a course-restricted code for the matching course", async () => {
      mockPromoCodeFindUnique.mockResolvedValue({
        id: "pc-course",
        code: "COURSE1",
        isActive: true,
        validFrom: new Date("2020-01-01"),
        validUntil: null,
        maxUses: 0,
        usedCount: 0,
        maxUsesPerUser: 1,
        usedBy: null,
        minAmount: 0,
        courseId: "course-A",
        discountType: "percentage",
        discountValue: 20,
        maxDiscount: null,
      });
      const result = await validatePromoCode("COURSE1", 1000, "user-1", "course-A");
      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(200);
    });

    it("should calculate percentage discount correctly", async () => {
      mockPromoCodeFindUnique.mockResolvedValue({
        id: "pc-1",
        code: "SAVE20",
        isActive: true,
        validFrom: new Date("2020-01-01"),
        validUntil: null,
        maxUses: 0,
        usedCount: 0,
        maxUsesPerUser: 1,
        usedBy: null,
        minAmount: 0,
        courseId: null,
        discountType: "percentage",
        discountValue: 20,
        maxDiscount: null,
      });
      const result = await validatePromoCode("SAVE20", 1000, "user-1", "course-1");
      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(200);
      expect(result.finalPrice).toBe(800);
    });

    it("should cap percentage discount at maxDiscount", async () => {
      mockPromoCodeFindUnique.mockResolvedValue({
        id: "pc-1",
        code: "SAVE50",
        isActive: true,
        validFrom: new Date("2020-01-01"),
        validUntil: null,
        maxUses: 0,
        usedCount: 0,
        maxUsesPerUser: 1,
        usedBy: null,
        minAmount: 0,
        courseId: null,
        discountType: "percentage",
        discountValue: 50,
        maxDiscount: 300,
      });
      const result = await validatePromoCode("SAVE50", 1000, "user-1", "course-1");
      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(300);
      expect(result.finalPrice).toBe(700);
    });

    it("should calculate fixed discount correctly", async () => {
      mockPromoCodeFindUnique.mockResolvedValue({
        id: "pc-1",
        code: "FIXED500",
        isActive: true,
        validFrom: new Date("2020-01-01"),
        validUntil: null,
        maxUses: 0,
        usedCount: 0,
        maxUsesPerUser: 1,
        usedBy: null,
        minAmount: 0,
        courseId: null,
        discountType: "fixed",
        discountValue: 500,
        maxDiscount: null,
      });
      const result = await validatePromoCode("FIXED500", 1000, "user-1", "course-1");
      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(500);
      expect(result.finalPrice).toBe(500);
    });

    it("should not allow discount to exceed original price", async () => {
      mockPromoCodeFindUnique.mockResolvedValue({
        id: "pc-1",
        code: "HUGE",
        isActive: true,
        validFrom: new Date("2020-01-01"),
        validUntil: null,
        maxUses: 0,
        usedCount: 0,
        maxUsesPerUser: 1,
        usedBy: null,
        minAmount: 0,
        courseId: null,
        discountType: "fixed",
        discountValue: 2000,
        maxDiscount: null,
      });
      const result = await validatePromoCode("HUGE", 1000, "user-1", "course-1");
      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(1000);
      expect(result.finalPrice).toBe(0);
    });
  });

  describe("redeemPromoCode", () => {
    it("should increment usedCount and add userId to usedBy", async () => {
      mockTxFindUnique.mockResolvedValue({
        id: "pc-1",
        usedBy: JSON.stringify(["user-A"]),
        usedCount: 1,
      });
      mockTxUpdate.mockResolvedValue({});

      await redeemPromoCode("pc-1", "user-B");

      expect(mockTxFindUnique).toHaveBeenCalledWith({
        where: { id: "pc-1" },
        select: { usedBy: true, usedCount: true },
      });
      expect(mockTxUpdate).toHaveBeenCalledWith({
        where: { id: "pc-1" },
        data: {
          usedCount: 2,
          usedBy: JSON.stringify(["user-A", "user-B"]),
        },
      });
    });

    it("should handle null usedBy field", async () => {
      mockTxFindUnique.mockResolvedValue({
        id: "pc-2",
        usedBy: null,
        usedCount: 0,
      });
      mockTxUpdate.mockResolvedValue({});

      await redeemPromoCode("pc-2", "user-1");

      expect(mockTxFindUnique).toHaveBeenCalledWith({
        where: { id: "pc-2" },
        select: { usedBy: true, usedCount: true },
      });
      expect(mockTxUpdate).toHaveBeenCalledWith({
        where: { id: "pc-2" },
        data: {
          usedCount: 1,
          usedBy: JSON.stringify(["user-1"]),
        },
      });
    });

    it("should handle non-existent promo code gracefully", async () => {
      mockTxFindUnique.mockResolvedValue(null);

      await redeemPromoCode("nonexistent", "user-1");

      expect(mockTxUpdate).not.toHaveBeenCalled();
    });

    it("should not increment if user already used the code", async () => {
      mockTxFindUnique.mockResolvedValue({
        id: "pc-3",
        usedBy: JSON.stringify(["user-A"]),
        usedCount: 1,
      });
      mockTxUpdate.mockResolvedValue({});

      await redeemPromoCode("pc-3", "user-A");

      expect(mockTxFindUnique).toHaveBeenCalledWith({
        where: { id: "pc-3" },
        select: { usedBy: true, usedCount: true },
      });
      expect(mockTxUpdate).not.toHaveBeenCalled();
    });
  });

  describe("generatePromoCode", () => {
    it("should generate a code of default length 8", () => {
      const code = generatePromoCode();
      expect(code).toHaveLength(8);
    });

    it("should generate a code of specified length", () => {
      const code = generatePromoCode(12);
      expect(code).toHaveLength(12);
    });

    it("should only contain uppercase letters and digits", () => {
      const code = generatePromoCode(20);
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });

    it("should generate different codes on subsequent calls", () => {
      const code1 = generatePromoCode();
      const code2 = generatePromoCode();
      // Extremely unlikely to be the same
      expect(code1).not.toBe(code2);
    });
  });
});
