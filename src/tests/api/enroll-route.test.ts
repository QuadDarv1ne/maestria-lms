// @vitest-environment node
/**
 * Route-level tests for POST /api/courses/[id]/enroll.
 *
 * The real handler is invoked; the Prisma transaction callback is executed
 * against a stub transaction client so the enrolment rules themselves are
 * exercised (free course, paid course, duplicate enrolment, prerequisites,
 * re-enrolment after cancellation, promo codes).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockDb, mockTx, mockHandleApiError, mockCreateNotification, mockSendEmail } = vi.hoisted(() => ({
  mockDb: {
    course: { findFirst: vi.fn(), findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  mockTx: {
    course: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    enrollment: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    payment: { create: vi.fn() },
  },
  mockHandleApiError: vi.fn(),
  mockCreateNotification: vi.fn(),
  mockSendEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
  Prisma: {},
}));

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
  requireAuth: vi.fn((session: { user?: unknown } | null) => Boolean(session?.user)),
  authErrorResponse: vi.fn(
    () => new Response(JSON.stringify({ error: "Необходимо авторизоваться" }), { status: 401 }),
  ),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: { enrollment: { windowMs: 60_000, maxRequests: 10 } },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock("@/lib/emails", () => ({
  enrollmentNotificationEmail: () => ({ subject: "subject", html: "<p>html</p>" }),
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));

vi.mock("@/lib/env", () => ({
  env: { siteUrl: "http://localhost:3000", isProduction: false },
}));

vi.mock("@/lib/utils", () => ({
  formatDate: () => "01.01.2026",
}));

vi.mock("@/lib/promo-code", () => ({
  validatePromoCode: vi.fn(),
  redeemPromoCode: vi.fn().mockResolvedValue(true),
}));

import { getAuthSession } from "@/lib/auth";
import { validatePromoCode, redeemPromoCode } from "@/lib/promo-code";
import { POST } from "@/app/api/courses/[id]/enroll/route";

const COURSE_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";

const baseCourse = {
  id: COURSE_ID,
  title: "Тестовый курс",
  slug: "test-course",
  price: 0,
  currency: "RUB",
  isPublished: true,
  visibility: "public",
  startDate: null,
  endDate: null,
  prerequisites: null,
  maxStudents: null,
  teacherId: "teacher-1",
};

const studentSession = { user: { id: "user-1", name: "Студент" } };

function enrollRequest(body: unknown = {}) {
  return new NextRequest(`http://localhost/api/courses/${COURSE_ID}/enroll`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function enrollContext() {
  return { params: Promise.resolve({ id: COURSE_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthSession).mockResolvedValue(studentSession as never);
  mockDb.course.findFirst.mockResolvedValue(baseCourse);
  mockDb.course.findMany.mockResolvedValue([]);
  mockDb.enrollment.findMany.mockResolvedValue([]);
  mockDb.user.findUnique.mockResolvedValue(null);
  mockCreateNotification.mockResolvedValue({ id: "notif-1" });
  mockSendEmail.mockResolvedValue(true);
  mockHandleApiError.mockReturnValue(new Response(JSON.stringify({ error: "internal" }), { status: 500 }));

  for (const group of Object.values(mockTx)) {
    for (const fn of Object.values(group as Record<string, ReturnType<typeof vi.fn>>)) {
      fn.mockReset();
    }
  }
  mockTx.course.findUnique.mockResolvedValue(baseCourse);
  mockTx.enrollment.findUnique.mockResolvedValue(null);

  mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockTx));
});

describe("POST /api/courses/[id]/enroll", () => {
  it("requires authentication", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const res = await POST(enrollRequest(), enrollContext());
    expect(res.status).toBe(401);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown course", async () => {
    mockDb.course.findFirst.mockResolvedValue(null);

    const res = await POST(enrollRequest(), enrollContext());
    expect(res.status).toBe(404);
  });

  it("rejects enrolment in an unpublished course", async () => {
    mockDb.course.findFirst.mockResolvedValue({ ...baseCourse, isPublished: false });

    const res = await POST(enrollRequest(), enrollContext());
    expect(res.status).toBe(400);
  });

  it("rejects enrolment in a private course", async () => {
    mockDb.course.findFirst.mockResolvedValue({ ...baseCourse, visibility: "private" });

    const res = await POST(enrollRequest(), enrollContext());
    expect(res.status).toBe(403);
  });

  it("enrols a student in a free course and notifies them", async () => {
    mockTx.enrollment.create.mockResolvedValue({ id: "enroll-1", status: "active" });

    const res = await POST(enrollRequest(), enrollContext());
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.enrollment).toEqual({ id: "enroll-1", status: "active" });
    expect(mockTx.enrollment.create).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockTx.payment.create).not.toHaveBeenCalled();
  });

  it("creates a pending payment instead of enrolling for a paid course", async () => {
    const paidCourse = { ...baseCourse, price: 5000 };
    mockDb.course.findFirst.mockResolvedValue(paidCourse);
    mockTx.course.findUnique.mockResolvedValue(paidCourse);
    mockTx.payment.create.mockResolvedValue({ id: "payment-1", status: "pending" });

    const res = await POST(enrollRequest({ paymentMethod: "sbp" }), enrollContext());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.requiresPayment).toBe(true);
    expect(body.paymentId).toBe("payment-1");
    expect(body.amount).toBe(5000);
    expect(mockTx.enrollment.create).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("rejects a duplicate active enrolment", async () => {
    mockTx.enrollment.findUnique.mockResolvedValue({ id: "enroll-0", status: "active" });

    const res = await POST(enrollRequest(), enrollContext());
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("уже записаны");
    expect(mockTx.enrollment.create).not.toHaveBeenCalled();
  });

  it("requires a fresh payment when a cancelled student re-enrols in a paid course", async () => {
    const paidCourse = { ...baseCourse, price: 5000 };
    mockDb.course.findFirst.mockResolvedValue(paidCourse);
    mockTx.course.findUnique.mockResolvedValue(paidCourse);
    mockTx.enrollment.findUnique.mockResolvedValue({ id: "enroll-0", status: "cancelled" });
    mockTx.payment.create.mockResolvedValue({ id: "payment-2", status: "pending" });

    const res = await POST(enrollRequest(), enrollContext());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.requiresPayment).toBe(true);
    expect(body.paymentId).toBe("payment-2");
    expect(mockTx.payment.create).toHaveBeenCalledTimes(1);
    expect(mockTx.enrollment.update).not.toHaveBeenCalled();
  });

  it("re-activates a cancelled enrolment in a free course", async () => {
    mockTx.enrollment.findUnique.mockResolvedValue({ id: "enroll-0", status: "cancelled" });
    mockTx.enrollment.update.mockResolvedValue({ id: "enroll-0", status: "active" });

    const res = await POST(enrollRequest(), enrollContext());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toContain("повторно");
    expect(mockTx.enrollment.update).toHaveBeenCalledTimes(1);
  });

  it("enforces the student limit for a free course", async () => {
    const limitedCourse = { ...baseCourse, maxStudents: 10 };
    mockDb.course.findFirst.mockResolvedValue(limitedCourse);
    mockTx.course.findUnique.mockResolvedValue(limitedCourse);
    mockTx.course.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(enrollRequest(), enrollContext());
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("лимит");
    expect(mockTx.enrollment.create).not.toHaveBeenCalled();
  });

  it("applies a valid promo code to the payment and redeems it", async () => {
    const paidCourse = { ...baseCourse, price: 5000 };
    mockDb.course.findFirst.mockResolvedValue(paidCourse);
    mockTx.course.findUnique.mockResolvedValue(paidCourse);
    mockTx.payment.create.mockResolvedValue({ id: "payment-3", status: "pending" });
    vi.mocked(validatePromoCode).mockResolvedValue({
      valid: true,
      finalPrice: 4000,
      discountAmount: 1000,
      promoCode: { id: "promo-1" },
    } as never);

    const res = await POST(enrollRequest({ promoCode: "SAVE10" }), enrollContext());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.amount).toBe(4000);

    const createArgs = mockTx.payment.create.mock.calls[0][0];
    expect(createArgs.data.discountAmount).toBe(1000);
    expect(createArgs.data.promoCodeId).toBe("promo-1");
    expect(vi.mocked(redeemPromoCode)).toHaveBeenCalledWith("promo-1", "user-1");
  });

  it("rejects an invalid promo code before creating a payment", async () => {
    const paidCourse = { ...baseCourse, price: 5000 };
    mockDb.course.findFirst.mockResolvedValue(paidCourse);
    vi.mocked(validatePromoCode).mockResolvedValue({
      valid: false,
      error: "Промокод не найден",
    } as never);

    const res = await POST(enrollRequest({ promoCode: "NOPE" }), enrollContext());
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Промокод");
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("blocks enrolment when prerequisites are not completed", async () => {
    const gatedCourse = {
      ...baseCourse,
      prerequisites: JSON.stringify(["prereq-1"]),
    };
    mockDb.course.findFirst.mockResolvedValue(gatedCourse);
    mockDb.enrollment.findMany.mockResolvedValue([]);
    mockDb.course.findMany.mockResolvedValue([{ id: "prereq-1", title: "Основы" }]);

    const res = await POST(enrollRequest(), enrollContext());
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.missingPrerequisites).toEqual([{ id: "prereq-1", title: "Основы" }]);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("allows enrolment once the prerequisites are completed", async () => {
    const gatedCourse = {
      ...baseCourse,
      prerequisites: JSON.stringify(["prereq-1"]),
    };
    mockDb.course.findFirst.mockResolvedValue(gatedCourse);
    mockDb.enrollment.findMany.mockResolvedValue([{ courseId: "prereq-1" }]);
    mockTx.enrollment.create.mockResolvedValue({ id: "enroll-2", status: "active" });

    const res = await POST(enrollRequest(), enrollContext());
    expect(res.status).toBe(201);
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
  });
});
