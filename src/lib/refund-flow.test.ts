/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb, mockCreateRefund, mockIsConfigured } = vi.hoisted(() => ({
  mockDb: {
    payment: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    enrollment: {
      updateMany: vi.fn(),
    },
    course: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockCreateRefund: vi.fn(),
  mockIsConfigured: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
  requireAdmin: vi.fn((s: any) => !!s?.user && s.user.role === "admin"),
  authErrorResponse: vi.fn(() =>
    new Response(JSON.stringify({ error: "Необходимо авторизоваться" }), { status: 401 }),
  ),
  adminErrorResponse: vi.fn(() =>
    new Response(JSON.stringify({ error: "Доступ запрещён" }), { status: 403 }),
  ),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: { admin: { windowMs: 60_000, maxRequests: 60 } },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: vi.fn((error: unknown) =>
    new Response(JSON.stringify({ error: String(error) }), { status: 500 }),
  ),
}));

vi.mock("@/lib/yookassa", () => ({
  createRefund: (...args: unknown[]) => mockCreateRefund(...args),
  isYooKassaConfigured: () => mockIsConfigured(),
  formatYooKassaAmount: (amount: number) => amount.toFixed(2),
}));

import { getAuthSession } from "@/lib/auth";
import { POST } from "@/app/api/admin/payments/[id]/refund/route";

function makeRequest(): any {
  return new Request("http://localhost/api/admin/payments/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/refund", { method: "POST" });
}

const completedPayment = {
  id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  userId: "user-1",
  courseId: "course-1",
  amount: 5000,
  currency: "RUB",
  status: "completed",
  transactionId: "2222222-3333-4444-5555-666666666666",
  course: { id: "course-1", title: "Test Course", currency: "RUB" },
  user: { id: "user-1", name: "Student", email: "s@example.com" },
};

const adminSession = { user: { id: "admin-1", role: "admin" } };

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
  mockCreateRefund.mockResolvedValue({ refundId: "ref-1", status: "succeeded" });
  vi.mocked(getAuthSession as any).mockResolvedValue(adminSession);
  mockDb.payment.updateMany.mockResolvedValue({ count: 1 });
  mockDb.enrollment.updateMany.mockResolvedValue({ count: 1 });
  mockDb.course.update.mockResolvedValue({});
  mockDb.$transaction.mockImplementation(async (fn: any) => fn({
    payment: mockDb.payment,
    enrollment: mockDb.enrollment,
    course: mockDb.course,
  }));
});

describe("Admin payment refund API", () => {
  it("requires authentication", async () => {
    (getAuthSession as any).mockResolvedValue(null);
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" }) });
    expect(res.status).toBe(401);
  });

  it("rejects non-admin", async () => {
    (getAuthSession as any).mockResolvedValue({ user: { id: "u1", role: "student" } });
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 when payment not found", async () => {
    mockDb.payment.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" }) });
    expect(res.status).toBe(404);
  });

  it("rejects non-completed payments", async () => {
    mockDb.payment.findUnique.mockResolvedValue({ ...completedPayment, status: "pending" });
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" }) });
    expect(res.status).toBe(400);
  });

  it("rejects already refunded payments", async () => {
    mockDb.payment.findUnique.mockResolvedValue({ ...completedPayment, status: "refunded" });
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" }) });
    expect(res.status).toBe(409);
  });

  it("issues a YooKassa refund, marks payment refunded and cancels enrollment", async () => {
    mockDb.payment.findUnique.mockResolvedValue(completedPayment);
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockCreateRefund).toHaveBeenCalledWith({
      paymentId: completedPayment.transactionId,
      amount: "5000.00",
      currency: "RUB",
      description: 'Возврат за курс "Test Course"',
    });
    expect(mockDb.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", status: "completed" },
      data: expect.objectContaining({ status: "refunded" }),
    });
    expect(mockDb.enrollment.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", courseId: "course-1", status: "active" },
      data: { status: "cancelled" },
    });
    expect(mockDb.course.update).toHaveBeenCalledWith({
      where: { id: "course-1" },
      data: { studentCount: { decrement: 1 } },
    });
    expect(body.refund.status).toBe("refunded");
  });

  it("returns 502 and leaves the payment untouched when the provider rejects the refund", async () => {
    mockDb.payment.findUnique.mockResolvedValue(completedPayment);
    mockCreateRefund.mockRejectedValue(new Error("YooKassa: insufficient_funds — rejected"));
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" }) });
    expect(res.status).toBe(502);
    expect(mockDb.payment.updateMany).not.toHaveBeenCalled();
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("allows manual refund (no provider / mock) when YooKassa is not configured", async () => {
    mockIsConfigured.mockReturnValue(false);
    mockDb.payment.findUnique.mockResolvedValue(completedPayment);
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockCreateRefund).not.toHaveBeenCalled();
    expect(body.refund.status).toBe("refunded");
    const call = mockDb.payment.updateMany.mock.calls[0][0];
    const stored = JSON.parse(call.data.paymentData);
    expect(stored.refundAmount).toBe(5000);
  });

  it("does not attempt an external refund for local txn_ ids", async () => {
    mockDb.payment.findUnique.mockResolvedValue({
      ...completedPayment,
      transactionId: "txn_1700000000000_uuid",
    });
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" }) });
    expect(res.status).toBe(200);
    expect(mockCreateRefund).not.toHaveBeenCalled();
  });
});