// @vitest-environment node
/**
 * Unit tests for batch reconciliation of stale pending payments
 * (src/lib/payments/reconcile.ts).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockDb, mockSync, mockNotify } = vi.hoisted(() => ({
  mockDb: {
    payment: { findMany: vi.fn() },
    course: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
  mockSync: vi.fn(),
  mockNotify: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb, Prisma: {} }));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/payments/service", () => ({
  syncPaymentWithProvider: mockSync,
  notifyPaymentCompleted: mockNotify,
}));

import { log } from "@/lib/logger";
import { reconcilePendingPayments } from "@/lib/payments/reconcile";

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.payment.findMany.mockResolvedValue([]);
  mockDb.course.findUnique.mockResolvedValue({ title: "Курс" });
  mockDb.user.findUnique.mockResolvedValue({ email: "u@test", name: "U" });
  mockSync.mockResolvedValue({ synced: false, status: "pending", reason: "provider_pending" });
});

describe("reconcilePendingPayments — selection", () => {
  it("queries only stale pending payments with a real provider id and caps the batch", async () => {
    const now = new Date("2026-01-10T12:00:00Z");
    await reconcilePendingPayments({
      minAgeMinutes: 30,
      maxAgeDays: 7,
      batchSize: 25,
      now,
    });

    expect(mockDb.payment.findMany).toHaveBeenCalledTimes(1);
    const args = mockDb.payment.findMany.mock.calls[0][0];

    expect(args.where.status).toBe("pending");
    expect(args.where.createdAt).toEqual({
      gte: new Date("2026-01-03T12:00:00Z"),
      lte: new Date("2026-01-10T11:30:00Z"),
    });
    expect(args.where.NOT).toEqual([
      { transactionId: null },
      { transactionId: { startsWith: "pending_" } },
      { transactionId: { startsWith: "sim_" } },
    ]);
    expect(args.where.paymentProvider).toEqual({ not: null });
    expect(args.orderBy).toEqual({ createdAt: "asc" });
    expect(args.take).toBe(25);
    expect(args.select).toEqual({ id: true });
  });

  it("uses defaults and clamps out-of-range options", async () => {
    const now = new Date("2026-01-10T12:00:00Z");
    await reconcilePendingPayments({
      minAgeMinutes: -10,
      maxAgeDays: 0,
      batchSize: 9999,
      now,
    });

    const args = mockDb.payment.findMany.mock.calls[0][0];
    expect(args.take).toBe(200);
    expect(args.where.createdAt.lte).toEqual(now); // minAge clamped to 0
    expect(args.where.createdAt.gte).toEqual(new Date("2026-01-09T12:00:00Z")); // maxAge clamped to 1 day
  });

  it("returns a zero summary when nothing is pending", async () => {
    const result = await reconcilePendingPayments();

    expect(result.scanned).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.pending).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.unknown).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(mockSync).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe("reconcilePendingPayments — outcome aggregation", () => {
  it("aggregates provider outcomes and notifies only for payments completed by this run", async () => {
    mockDb.payment.findMany.mockResolvedValue([
      { id: "pay-new" },
      { id: "pay-race" },
      { id: "pay-failed" },
      { id: "pay-pending" },
      { id: "pay-unknown" },
      { id: "pay-skipped" },
      { id: "pay-broken" },
    ]);

    const completedPayment = { id: "pay-new", userId: "user-1", courseId: "course-1" };
    mockSync
      .mockResolvedValueOnce({
        synced: true,
        status: "completed",
        alreadyCompleted: false,
        payment: completedPayment,
      })
      .mockResolvedValueOnce({
        synced: true,
        status: "completed",
        alreadyCompleted: true,
        payment: { id: "pay-race", userId: "user-1", courseId: "course-1" },
      })
      .mockResolvedValueOnce({ synced: true, status: "failed" })
      .mockResolvedValueOnce({ synced: false, status: "pending" })
      .mockResolvedValueOnce({ synced: false, status: "unknown" })
      .mockResolvedValueOnce({ synced: false, status: "skipped" })
      .mockRejectedValueOnce(new Error("db exploded"));

    const result = await reconcilePendingPayments();

    expect(result).toMatchObject({
      scanned: 7,
      completed: 2,
      failed: 1,
      pending: 1,
      skipped: 1,
      unknown: 1,
      errors: 1,
    });
    expect(mockSync).toHaveBeenCalledTimes(7);

    // Only the call that actually completed the payment sends the purchase
    // notification — a race with a webhook must not duplicate the email.
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith(
      completedPayment,
      "Курс",
      "U",
      "u@test",
    );
    expect(log.error).toHaveBeenCalledWith(
      "Payment reconcile: failed to process payment",
      expect.objectContaining({ paymentId: "pay-broken" }),
    );
  });

  it("does not notify when the course or user no longer exists", async () => {
    mockDb.payment.findMany.mockResolvedValue([{ id: "pay-1" }]);
    mockSync.mockResolvedValueOnce({
      synced: true,
      status: "completed",
      alreadyCompleted: false,
      payment: { id: "pay-1", userId: "user-1", courseId: "course-1" },
    });
    mockDb.course.findUnique.mockResolvedValueOnce(null);

    const result = await reconcilePendingPayments();

    expect(result.completed).toBe(1);
    expect(mockNotify).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      "Payment reconcile: cannot notify, course or user missing",
      expect.objectContaining({ paymentId: "pay-1" }),
    );
  });
});
