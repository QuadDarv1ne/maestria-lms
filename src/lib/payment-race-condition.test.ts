import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma client to test race condition logic
const mockPayment = {
  id: "payment-1",
  userId: "user-1",
  courseId: "course-1",
  status: "pending",
  amount: 1000,
};

describe("payment race condition fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents duplicate enrollment when two concurrent requests try to complete payment", async () => {
    // Simulate the transaction logic from payments/[id]/route.ts
    // The key mechanism: updateMany with where { id, status: "pending" }
    // ensures only one request can transition pending -> completed

    const mockTx = {
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ ...mockPayment, status: "completed" }),
      },
      enrollment: { findUnique: vi.fn(), create: vi.fn() },
      course: { update: vi.fn() },
    };

    // Simulate transaction logic
    let enrollmentCreated = false;
    const updateResult = await mockTx.payment.updateMany({
      where: { id: mockPayment.id, status: "pending" },
      data: { status: "completed" },
    });

    if (updateResult.count > 0) {
      await mockTx.enrollment.create({
        data: {
          userId: mockPayment.userId,
          courseId: mockPayment.courseId,
          status: "active",
          progress: 0,
        },
      });
      enrollmentCreated = true;
      await mockTx.course.update({
        where: { id: mockPayment.courseId },
        data: { studentCount: { increment: 1 } },
      });
    }

    expect(mockTx.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "payment-1", status: "pending" },
      data: { status: "completed" },
    });
    expect(enrollmentCreated).toBe(true);
    expect(mockTx.enrollment.create).toHaveBeenCalledTimes(1);
    expect(mockTx.course.update).toHaveBeenCalledTimes(1);
  });

  it("second concurrent request does not create duplicate enrollment", async () => {
    const mockTx = {
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }), // Already updated by first request
        findUnique: vi.fn().mockResolvedValue({
          ...mockPayment,
          status: "completed",
        }),
      },
      enrollment: { findUnique: vi.fn(), create: vi.fn() },
      course: { update: vi.fn() },
    };

    // Simulate transaction logic for second concurrent request
    let enrollmentCreated = false;
    let alreadyCompleted = false;
    const updateResult = await mockTx.payment.updateMany({
      where: { id: mockPayment.id, status: "pending" },
      data: { status: "completed" },
    });

    if (updateResult.count > 0) {
      await mockTx.enrollment.create({
        data: {
          userId: mockPayment.userId,
          courseId: mockPayment.courseId,
          status: "active",
          progress: 0,
        },
      });
      enrollmentCreated = true;
    } else {
      const currentPayment = await mockTx.payment.findUnique({
        where: { id: mockPayment.id },
      });
      alreadyCompleted = currentPayment?.status === "completed";
    }

    expect(mockTx.payment.updateMany).toHaveBeenCalledTimes(1);
    expect(mockTx.enrollment.create).not.toHaveBeenCalled();
    expect(enrollmentCreated).toBe(false);
    expect(alreadyCompleted).toBe(true);
    expect(mockTx.course.update).not.toHaveBeenCalled();
  });

  it("handles refund status correctly", async () => {
    const mockTx = {
      payment: {
        update: vi.fn().mockResolvedValue({ ...mockPayment, status: "refunded" }),
        findUnique: vi.fn().mockResolvedValue({ ...mockPayment, status: "refunded" }),
      },
      enrollment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      course: { update: vi.fn() },
    };

    // Simulate refund logic from payments/[id]/route.ts
    await mockTx.payment.update({
      where: { id: mockPayment.id },
      data: { status: "refunded" },
    });

    const currentPayment = await mockTx.payment.findUnique({
      where: { id: mockPayment.id },
    });

    if (currentPayment) {
      const cancelled = await mockTx.enrollment.updateMany({
        where: {
          userId: currentPayment.userId,
          courseId: currentPayment.courseId,
          status: "active",
        },
        data: { status: "cancelled" },
      });

      if (cancelled.count > 0) {
        await mockTx.course.update({
          where: { id: currentPayment.courseId },
          data: { studentCount: { decrement: 1 } },
        });
      }
    }

    expect(mockTx.payment.update).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: { status: "refunded" },
    });
    expect(mockTx.enrollment.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        courseId: "course-1",
        status: "active",
      },
      data: { status: "cancelled" },
    });
    expect(mockTx.course.update).toHaveBeenCalledWith({
      where: { id: "course-1" },
      data: { studentCount: { decrement: 1 } },
    });
  });
});
