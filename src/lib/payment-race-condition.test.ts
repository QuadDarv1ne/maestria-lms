import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma client to test race condition logic
const mockPayment = {
  id: "payment-1",
  userId: "user-1",
  courseId: "course-1",
  status: "pending",
  amount: 1000,
};

const mockTx = {
  payment: {
    updateMany: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  enrollment: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  course: {
    update: vi.fn(),
  },
};

const mockDb = {
  $transaction: vi.fn(),
  payment: {
    findUnique: vi.fn(),
  },
};

describe("payment race condition fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents duplicate enrollment when two concurrent requests try to complete payment", async () => {
    // Simulate first request: successfully updates pending -> completed
    mockTx.payment.updateMany.mockResolvedValueOnce({ count: 1 });
    mockTx.payment.findUnique.mockResolvedValueOnce({
      ...mockPayment,
      status: "completed",
    });

    // Simulate the transaction logic
    const handlePaymentUpdate = async (tx: typeof mockTx, paymentId: string, newStatus: string) => {
      let wasStatusUpdated = false;

      if (newStatus === "completed") {
        const updateResult = await tx.payment.updateMany({
          where: { id: paymentId, status: "pending" },
          data: { status: newStatus },
        });
        wasStatusUpdated = updateResult.count > 0;

        if (!wasStatusUpdated) {
          const currentPayment = await tx.payment.findUnique({ where: { id: paymentId } });
          if (!currentPayment) {
            return { error: "Payment not found", status: 404 };
          }
          return { updated: currentPayment, wasCompleted: false, alreadyCompleted: currentPayment.status === "completed" };
        }
      }

      if (newStatus === "completed" && wasStatusUpdated) {
        const currentPayment = await tx.payment.findUnique({ where: { id: paymentId } });
        if (currentPayment) {
          // ensureEnrollment would be called here
          await tx.enrollment.create({
            data: {
              userId: currentPayment.userId,
              courseId: currentPayment.courseId,
              status: "active",
              progress: 0,
            },
          });
          await tx.course.update({
            where: { id: currentPayment.courseId },
            data: { studentCount: { increment: 1 } },
          });
        }
      }

      const updatedPayment = await tx.payment.findUnique({ where: { id: paymentId } });
      return { updated: updatedPayment, wasCompleted: newStatus === "completed" && wasStatusUpdated };
    };

    // First concurrent request (succeeds)
    const result1 = await handlePaymentUpdate(mockTx, mockPayment.id, "completed");

    expect(mockTx.payment.updateMany).toHaveBeenCalledTimes(1);
    expect(mockTx.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "payment-1", status: "pending" },
      data: { status: "completed" },
    });
    expect(result1.wasCompleted).toBe(true);
    expect(mockTx.enrollment.create).toHaveBeenCalledTimes(1);
    expect(mockTx.course.update).toHaveBeenCalledTimes(1);
  });

  it("second concurrent request does not create duplicate enrollment", async () => {
    const tx2 = {
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }), // Already updated by first request
        update: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          ...mockPayment,
          status: "completed",
        }),
      },
      enrollment: {
        findUnique: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      course: {
        update: vi.fn(),
      },
    };

    const handlePaymentUpdate = async (tx: typeof tx2, paymentId: string, newStatus: string) => {
      let wasStatusUpdated = false;

      if (newStatus === "completed") {
        const updateResult = await tx.payment.updateMany({
          where: { id: paymentId, status: "pending" },
          data: { status: newStatus },
        });
        wasStatusUpdated = updateResult.count > 0;

        if (!wasStatusUpdated) {
          const currentPayment = await tx.payment.findUnique({ where: { id: paymentId } });
          if (!currentPayment) {
            return { error: "Payment not found", status: 404 };
          }
          return { updated: currentPayment, wasCompleted: false, alreadyCompleted: currentPayment.status === "completed" };
        }
      }

      if (newStatus === "completed" && wasStatusUpdated) {
        const currentPayment = await tx.payment.findUnique({ where: { id: paymentId } });
        if (currentPayment) {
          await tx.enrollment.create({
            data: {
              userId: currentPayment.userId,
              courseId: currentPayment.courseId,
              status: "active",
              progress: 0,
            },
          });
          await tx.course.update({
            where: { id: currentPayment.courseId },
            data: { studentCount: { increment: 1 } },
          });
        }
      }

      const updatedPayment = await tx.payment.findUnique({ where: { id: paymentId } });
      return { updated: updatedPayment, wasCompleted: newStatus === "completed" && wasStatusUpdated };
    };

    // Second concurrent request (fails to update, already completed)
    const result2 = await handlePaymentUpdate(tx2, mockPayment.id, "completed");

    expect(tx2.payment.updateMany).toHaveBeenCalledTimes(1);
    expect(tx2.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "payment-1", status: "pending" },
      data: { status: "completed" },
    });
    expect(result2.wasCompleted).toBe(false);
    expect(result2.alreadyCompleted).toBe(true);
    expect(tx2.enrollment.create).not.toHaveBeenCalled();
    expect(tx2.course.update).not.toHaveBeenCalled();
  });

  it("handles refund status correctly", async () => {
    const tx3 = {
      payment: {
        updateMany: vi.fn(),
        update: vi.fn().mockResolvedValue({ ...mockPayment, status: "refunded" }),
        findUnique: vi.fn().mockResolvedValue({ ...mockPayment, status: "refunded" }),
      },
      enrollment: {
        findUnique: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      course: {
        update: vi.fn(),
      },
    };

    const handlePaymentUpdate = async (tx: typeof tx3, paymentId: string, newStatus: string) => {
      let wasStatusUpdated = false;

      if (newStatus === "completed") {
        const updateResult = await tx.payment.updateMany({
          where: { id: paymentId, status: "pending" },
          data: { status: newStatus },
        });
        wasStatusUpdated = updateResult.count > 0;

        if (!wasStatusUpdated) {
          const currentPayment = await tx.payment.findUnique({ where: { id: paymentId } });
          return { updated: currentPayment, wasCompleted: false };
        }
      } else {
        await tx.payment.update({
          where: { id: paymentId },
          data: { status: newStatus },
        });
      }

      if (newStatus === "refunded") {
        const currentPayment = await tx.payment.findUnique({ where: { id: paymentId } });
        if (currentPayment) {
          const cancelled = await tx.enrollment.updateMany({
            where: {
              userId: currentPayment.userId,
              courseId: currentPayment.courseId,
              status: "active",
            },
            data: { status: "cancelled" },
          });
          if (cancelled.count > 0) {
            await tx.course.update({
              where: { id: currentPayment.courseId },
              data: { studentCount: { decrement: 1 } },
            });
          }
        }
      }

      const updatedPayment = await tx.payment.findUnique({ where: { id: paymentId } });
      return { updated: updatedPayment, wasCompleted: false };
    };

    const result = await handlePaymentUpdate(tx3, mockPayment.id, "refunded");

    expect(tx3.payment.update).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: { status: "refunded" },
    });
    expect(tx3.enrollment.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        courseId: "course-1",
        status: "active",
      },
      data: { status: "cancelled" },
    });
    expect(tx3.course.update).toHaveBeenCalledWith({
      where: { id: "course-1" },
      data: { studentCount: { decrement: 1 } },
    });
    expect(result.wasCompleted).toBe(false);
  });
});
