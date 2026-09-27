// @vitest-environment node
/**
 * Route-level tests for the payments API: creation, listing and single payment
 * access control.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockDb, mockTx, mockHandleApiError } = vi.hoisted(() => ({
  mockDb: {
    course: { findUnique: vi.fn() },
    payment: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
  mockTx: {
    payment: { findFirst: vi.fn(), create: vi.fn() },
  },
  mockHandleApiError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
  Prisma: {},
}));

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
  requireAuth: vi.fn((session: { user?: unknown } | null) => Boolean(session?.user)),
  requireAdmin: vi.fn((session: { user?: { role?: string } } | null) => session?.user?.role === "admin"),
  authErrorResponse: vi.fn(
    () => new Response(JSON.stringify({ error: "Необходимо авторизоваться" }), { status: 401 }),
  ),
  adminErrorResponse: vi.fn(
    () => new Response(JSON.stringify({ error: "Доступ запрещён" }), { status: 403 }),
  ),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: {
    payments: { windowMs: 60_000, maxRequests: 20 },
    paymentUpdate: { windowMs: 60_000, maxRequests: 20 },
  },
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
}));

vi.mock("@/lib/utils", () => ({
  parsePagination: (_searchParams: URLSearchParams, opts?: { defaultLimit?: number }) => ({
    page: 1,
    limit: opts?.defaultLimit ?? 20,
    skip: 0,
  }),
}));

vi.mock("@/lib/promo-code", () => ({
  validatePromoCode: vi.fn(),
  redeemPromoCode: vi.fn().mockResolvedValue(true),
}));

import { getAuthSession } from "@/lib/auth";
import { POST, GET as listPayments } from "@/app/api/payments/route";
import { GET as getPayment } from "@/app/api/payments/[id]/route";

const PAYMENT_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const COURSE_ID = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const OTHER_USER_ID = "user-other";

const studentSession = { user: { id: "user-1", role: "student" } };

const paidCourse = { id: COURSE_ID, price: 5000, currency: "RUB", isPublished: true, title: "Курс" };

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/payments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function paymentContext(id = PAYMENT_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthSession).mockResolvedValue(studentSession as never);
  mockDb.course.findUnique.mockResolvedValue(paidCourse);
  mockDb.payment.findFirst.mockResolvedValue(null);
  mockDb.payment.findMany.mockResolvedValue([]);
  mockDb.payment.count.mockResolvedValue(0);
  mockHandleApiError.mockReturnValue(new Response(JSON.stringify({ error: "internal" }), { status: 500 }));

  mockTx.payment.findFirst.mockReset();
  mockTx.payment.create.mockReset();
  mockTx.payment.findFirst.mockResolvedValue(null);
  mockTx.payment.create.mockResolvedValue({
    id: PAYMENT_ID,
    amount: 5000,
    currency: "RUB",
    status: "pending",
    paymentMethod: "sbp",
    paymentProvider: "СБП",
    transactionId: "txn_1",
    createdAt: new Date("2026-09-27T00:00:00Z"),
  });

  mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockTx));
});

describe("POST /api/payments", () => {
  it("requires authentication", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const res = await POST(postRequest({ courseId: COURSE_ID, paymentMethod: "sbp" }));
    expect(res.status).toBe(401);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an unknown payment method", async () => {
    const res = await POST(postRequest({ courseId: COURSE_ID, paymentMethod: "bitcoin" }));
    expect(res.status).toBe(400);
    expect(mockDb.course.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a payment for a free course", async () => {
    mockDb.course.findUnique.mockResolvedValue({ ...paidCourse, price: 0 });

    const res = await POST(postRequest({ courseId: COURSE_ID, paymentMethod: "sbp" }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("бесплатн");
  });

  it("returns 404 for an unpublished or missing course", async () => {
    mockDb.course.findUnique.mockResolvedValue(null);

    const res = await POST(postRequest({ courseId: COURSE_ID, paymentMethod: "sbp" }));
    expect(res.status).toBe(404);
  });

  it("creates a pending payment", async () => {
    const res = await POST(postRequest({ courseId: COURSE_ID, paymentMethod: "sbp" }));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.message).toContain("Платёж создан");
    expect(body.payment.id).toBe(PAYMENT_ID);
    expect(mockTx.payment.create).toHaveBeenCalledTimes(1);
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns the existing pending payment instead of creating a duplicate", async () => {
    const existing = { id: PAYMENT_ID, amount: 5000, currency: "RUB", status: "pending" };
    mockDb.payment.findFirst.mockResolvedValue(existing);

    const res = await POST(postRequest({ courseId: COURSE_ID, paymentMethod: "sbp" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.paymentId).toBe(PAYMENT_ID);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a course that is already paid", async () => {
    mockDb.payment.findFirst.mockResolvedValue({ id: PAYMENT_ID, status: "completed" });

    const res = await POST(postRequest({ courseId: COURSE_ID, paymentMethod: "sbp" }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("уже оплачен");
  });

  it("maps a payment race condition to a 400 response", async () => {
    mockDb.$transaction.mockImplementation(async () => {
      throw new Error("COURSE_ALREADY_PAID");
    });

    const res = await POST(postRequest({ courseId: COURSE_ID, paymentMethod: "sbp" }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("уже оплачен");
    expect(mockHandleApiError).not.toHaveBeenCalled();
  });
});

describe("GET /api/payments", () => {
  it("requires authentication", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const res = await listPayments(new NextRequest("http://localhost/api/payments"));
    expect(res.status).toBe(401);
  });

  it("scopes the list to the current user", async () => {
    mockDb.payment.findMany.mockResolvedValue([{ id: PAYMENT_ID, amount: 5000 }]);
    mockDb.payment.count.mockResolvedValue(1);

    const res = await listPayments(new NextRequest("http://localhost/api/payments"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.payments).toHaveLength(1);
    expect(body.pagination.total).toBe(1);

    const listArgs = mockDb.payment.findMany.mock.calls[0][0];
    expect(listArgs.where).toEqual({ userId: "user-1" });
    const countArgs = mockDb.payment.count.mock.calls[0][0];
    expect(countArgs.where).toEqual({ userId: "user-1" });
  });
});

describe("GET /api/payments/[id]", () => {
  it("requires a valid uuid", async () => {
    const res = await getPayment(new NextRequest("http://localhost/api/payments/not-a-uuid"), paymentContext("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(mockDb.payment.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing payment", async () => {
    mockDb.payment.findUnique.mockResolvedValue(null);

    const res = await getPayment(new NextRequest(`http://localhost/api/payments/${PAYMENT_ID}`), paymentContext());
    expect(res.status).toBe(404);
  });

  it("forbids access to another user's payment", async () => {
    mockDb.payment.findUnique.mockResolvedValue({ id: PAYMENT_ID, userId: OTHER_USER_ID });

    const res = await getPayment(new NextRequest(`http://localhost/api/payments/${PAYMENT_ID}`), paymentContext());
    expect(res.status).toBe(403);
  });

  it("returns the caller's own payment", async () => {
    mockDb.payment.findUnique.mockResolvedValue({ id: PAYMENT_ID, userId: "user-1", amount: 5000 });

    const res = await getPayment(new NextRequest(`http://localhost/api/payments/${PAYMENT_ID}`), paymentContext());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.payment.id).toBe(PAYMENT_ID);
  });

  it("allows an admin to read another user's payment", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never);
    mockDb.payment.findUnique.mockResolvedValue({ id: PAYMENT_ID, userId: OTHER_USER_ID, amount: 5000 });

    const res = await getPayment(new NextRequest(`http://localhost/api/payments/${PAYMENT_ID}`), paymentContext());
    expect(res.status).toBe(200);
  });
});
