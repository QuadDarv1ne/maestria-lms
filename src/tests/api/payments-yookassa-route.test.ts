// @vitest-environment node
/**
 * Route-level tests for the YooKassa payment endpoints:
 *   POST /api/payments/[id]/init-yookassa
 *   POST /api/payments/[id]/simulate-complete
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockDb, mockTx, mockHandleApiError, mockCreatePayment, mockIsYooKassaConfigured, mockEnv } = vi.hoisted(
  () => ({
    mockDb: {
      payment: { findUnique: vi.fn(), update: vi.fn() },
      enrollment: { findUnique: vi.fn() },
      course: { updateMany: vi.fn() },
      $transaction: vi.fn(),
    },
    mockTx: {
      payment: { updateMany: vi.fn() },
      enrollment: { findUnique: vi.fn(), upsert: vi.fn() },
      course: { updateMany: vi.fn() },
    },
    mockHandleApiError: vi.fn(),
    mockCreatePayment: vi.fn(),
    mockIsYooKassaConfigured: vi.fn(),
    mockEnv: { siteUrl: "https://app.test", isDevelopment: true, isProduction: false },
  }),
);

vi.mock("@/lib/db", () => ({ db: mockDb, Prisma: {} }));
vi.mock("@/lib/env", () => ({ env: mockEnv }));

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
  requireAuth: vi.fn((session: { user?: unknown } | null) => Boolean(session?.user)),
  requireAdmin: vi.fn((session: { user?: { role?: string } } | null) => session?.user?.role === "admin"),
  authErrorResponse: vi.fn(() => new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 })),
  adminErrorResponse: vi.fn(() => new Response(JSON.stringify({ error: "Запрещено" }), { status: 403 })),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: { payments: { windowMs: 60_000, maxRequests: 20 }, paymentUpdate: { windowMs: 60_000, maxRequests: 20 } },
}));

vi.mock("@/lib/yookassa", () => ({
  createPayment: (...args: unknown[]) => mockCreatePayment(...args),
  isYooKassaConfigured: () => mockIsYooKassaConfigured(),
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { getAuthSession } from "@/lib/auth";
import { POST as initYooKassa } from "@/app/api/payments/[id]/init-yookassa/route";
import { POST as simulateComplete } from "@/app/api/payments/[id]/simulate-complete/route";

const PAYMENT_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const OTHER_USER_ID = "user-other";

const studentSession = { user: { id: "user-1", role: "student" } };

const pendingYooKassaPayment = {
  id: PAYMENT_ID,
  userId: "user-1",
  courseId: "course-1",
  amount: 5000,
  currency: "RUB",
  status: "pending",
  paymentMethod: "yookassa",
  paymentData: null,
  course: { title: "Курс", price: 5000, currency: "RUB" },
};

function context() {
  return { params: Promise.resolve({ id: PAYMENT_ID }) };
}

function request() {
  return new NextRequest(`http://localhost/api/payments/${PAYMENT_ID}/init-yookassa`, { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.isDevelopment = true;
  mockEnv.isProduction = false;
  vi.mocked(getAuthSession).mockResolvedValue(studentSession as never);
  mockDb.payment.findUnique.mockResolvedValue(pendingYooKassaPayment);
  mockDb.payment.update.mockResolvedValue(pendingYooKassaPayment);
  mockDb.enrollment.findUnique.mockResolvedValue(null);
  mockDb.course.updateMany.mockResolvedValue({ count: 1 });
  mockIsYooKassaConfigured.mockReturnValue(true);
  mockCreatePayment.mockResolvedValue({
    yooKassaId: "yk-1",
    confirmationUrl: "https://yookassa.test/confirm/yk-1",
  });
  mockHandleApiError.mockReturnValue(new Response(JSON.stringify({ error: "internal" }), { status: 500 }));

  mockTx.payment.updateMany.mockReset();
  mockTx.enrollment.findUnique.mockReset();
  mockTx.enrollment.upsert.mockReset();
  mockTx.course.updateMany.mockReset();
  mockTx.payment.updateMany.mockResolvedValue({ count: 1 });
  mockTx.enrollment.findUnique.mockResolvedValue(null);
  mockTx.enrollment.upsert.mockResolvedValue({ id: "enroll-1", status: "active" });
  mockTx.course.updateMany.mockResolvedValue({ count: 1 });
  mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockTx));
});

describe("POST /api/payments/[id]/init-yookassa", () => {
  it("requires authentication", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const res = await initYooKassa(request(), context());
    expect(res.status).toBe(401);
    expect(mockCreatePayment).not.toHaveBeenCalled();
  });

  it("rejects a malformed payment id", async () => {
    const res = await initYooKassa(request(), { params: Promise.resolve({ id: "not-a-uuid" }) });
    expect(res.status).toBe(400);
    expect(mockDb.payment.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing payment", async () => {
    mockDb.payment.findUnique.mockResolvedValue(null);

    const res = await initYooKassa(request(), context());
    expect(res.status).toBe(404);
  });

  it("forbids another user's payment", async () => {
    mockDb.payment.findUnique.mockResolvedValue({ ...pendingYooKassaPayment, userId: OTHER_USER_ID });

    const res = await initYooKassa(request(), context());
    expect(res.status).toBe(403);
    expect(mockCreatePayment).not.toHaveBeenCalled();
  });

  it("rejects a payment that is not pending", async () => {
    mockDb.payment.findUnique.mockResolvedValue({ ...pendingYooKassaPayment, status: "completed" });

    const res = await initYooKassa(request(), context());
    expect(res.status).toBe(400);
    expect(mockCreatePayment).not.toHaveBeenCalled();
  });

  it("rejects a payment created with another method", async () => {
    mockDb.payment.findUnique.mockResolvedValue({ ...pendingYooKassaPayment, paymentMethod: "sbp" });

    const res = await initYooKassa(request(), context());
    expect(res.status).toBe(400);
    expect(mockCreatePayment).not.toHaveBeenCalled();
  });

  it("reuses the stored confirmation instead of creating a second payment", async () => {
    mockDb.payment.findUnique.mockResolvedValue({
      ...pendingYooKassaPayment,
      paymentData: JSON.stringify({ yooKassaId: "yk-existing", confirmationUrl: "https://yookassa.test/old" }),
    });

    const res = await initYooKassa(request(), context());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.yooKassaId).toBe("yk-existing");
    expect(body.confirmationUrl).toBe("https://yookassa.test/old");
    expect(mockCreatePayment).not.toHaveBeenCalled();
  });

  it("falls back to test mode when YooKassa is not configured", async () => {
    mockIsYooKassaConfigured.mockReturnValue(false);

    const res = await initYooKassa(request(), context());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.testMode).toBe(true);
    expect(mockCreatePayment).not.toHaveBeenCalled();
  });

  it("creates the payment and stores the confirmation data", async () => {
    const res = await initYooKassa(request(), context());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.yooKassaId).toBe("yk-1");
    expect(body.confirmationUrl).toBe("https://yookassa.test/confirm/yk-1");

    expect(mockCreatePayment).toHaveBeenCalledTimes(1);
    const createArgs = mockCreatePayment.mock.calls[0][0] as { amount: string; returnUrl: string; metadata: { paymentId: string } };
    expect(createArgs.amount).toBe("5000.00");
    expect(createArgs.returnUrl).toBe(`https://app.test/payment/${PAYMENT_ID}`);
    expect(createArgs.metadata.paymentId).toBe(PAYMENT_ID);

    const updateArgs = mockDb.payment.update.mock.calls[0][0] as { data: { paymentData: string } };
    expect(JSON.parse(updateArgs.data.paymentData)).toEqual({
      yooKassaId: "yk-1",
      confirmationUrl: "https://yookassa.test/confirm/yk-1",
    });
  });

  it("maps a provider failure to 502 instead of a generic 500", async () => {
    mockCreatePayment.mockRejectedValue(new Error("YooKassa: API unavailable"));

    const res = await initYooKassa(request(), context());
    expect(res.status).toBe(502);
    expect(mockHandleApiError).not.toHaveBeenCalled();
  });
});

describe("POST /api/payments/[id]/simulate-complete", () => {
  it("requires authentication", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const res = await simulateComplete(request(), context());
    expect(res.status).toBe(401);
  });

  it("returns 404 for a missing payment", async () => {
    mockDb.payment.findUnique.mockResolvedValue(null);

    const res = await simulateComplete(request(), context());
    expect(res.status).toBe(404);
  });

  it("forbids another user's payment", async () => {
    mockDb.payment.findUnique.mockResolvedValue({ ...pendingYooKassaPayment, userId: OTHER_USER_ID });

    const res = await simulateComplete(request(), context());
    expect(res.status).toBe(403);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an already processed payment", async () => {
    mockDb.payment.findUnique.mockResolvedValue({ ...pendingYooKassaPayment, status: "completed" });

    const res = await simulateComplete(request(), context());
    expect(res.status).toBe(400);
  });

  it("completes the payment and ensures the enrolment", async () => {
    const res = await simulateComplete(request(), context());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toContain("успешно завершён");

    expect(mockTx.payment.updateMany).toHaveBeenCalledTimes(1);
    expect(mockTx.enrollment.upsert).toHaveBeenCalledTimes(1);
    expect(mockTx.course.updateMany).toHaveBeenCalledTimes(1);
  });

  it("does not increment the course counter for an existing enrolment", async () => {
    mockTx.enrollment.findUnique.mockResolvedValue({ id: "enroll-1", status: "active" });

    const res = await simulateComplete(request(), context());
    expect(res.status).toBe(200);
    expect(mockTx.course.updateMany).not.toHaveBeenCalled();
  });
});
