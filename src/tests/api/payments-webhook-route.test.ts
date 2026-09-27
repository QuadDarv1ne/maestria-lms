// @vitest-environment node
/**
 * Route-level tests for POST /api/payments/webhook.
 *
 * The real signature verification runs (HMAC over the raw body); the database
 * and side-effect modules are stubbed so the handler logic itself is exercised.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "node:crypto";

const { mockDb, mockEnv, mockHandleApiError, mockCreateNotification, mockSendEmail } = vi.hoisted(() => ({
  mockDb: {
    payment: { findFirst: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
  mockEnv: {
    siteUrl: "http://localhost:3000",
    paymentWebhookSecret: "test-webhook-secret",
    isProduction: false,
  },
  mockHandleApiError: vi.fn(),
  mockCreateNotification: vi.fn(),
  mockSendEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
  Prisma: {},
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: {},
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock("@/lib/emails", () => ({
  coursePurchaseEmail: () => ({ subject: "subject", html: "<p>html</p>" }),
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));

import { POST } from "@/app/api/payments/webhook/route";

const WEBHOOK_URL = "http://localhost/api/payments/webhook";
const SECRET = "test-w…cret";

function sign(body: string, secret = SECRET) {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

function webhookRequest(body: string, signature: string | null) {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature !== null) headers.set("x-webhook-signature", signature);
  return new NextRequest(WEBHOOK_URL, { method: "POST", body, headers });
}

const pendingPayment = {
  id: "payment-1",
  userId: "user-1",
  courseId: "course-1",
  amount: 5000,
  currency: "RUB",
  status: "pending",
  transactionId: "txn-1",
  course: { id: "course-1", title: "Курс" },
  user: { id: "user-1", email: "student@example.com", name: "Студент" },
};

const completedPayment = { ...pendingPayment, status: "completed" };

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.paymentWebhookSecret = SECRET;
  mockDb.payment.findFirst.mockResolvedValue(pendingPayment);
  mockDb.payment.updateMany.mockResolvedValue({ count: 1 });
  mockCreateNotification.mockResolvedValue({ id: "notif-1" });
  mockSendEmail.mockResolvedValue(true);
  mockHandleApiError.mockReturnValue(new Response(JSON.stringify({ error: "internal" }), { status: 500 }));

  mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      payment: {
        findUnique: vi.fn().mockResolvedValue(pendingPayment),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      course: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
      enrollment: {
        upsert: vi.fn().mockResolvedValue({ id: "enroll-1", status: "active" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    }),
  );
});

afterEach(() => {
  mockEnv.paymentWebhookSecret = SECRET;
});

describe("POST /api/payments/webhook", () => {
  it("rejects a request with an invalid signature", async () => {
    const body = JSON.stringify({ status: "succeeded" });

    const res = await POST(webhookRequest(body, "sha256=deadbeef"));
    expect(res.status).toBe(401);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a request with no signature at all", async () => {
    const res = await POST(webhookRequest(JSON.stringify({ status: "succeeded" }), null));
    expect(res.status).toBe(401);
  });

  it("returns 501 when the webhook secret is not configured", async () => {
    mockEnv.paymentWebhookSecret = "";
    const body = JSON.stringify({ status: "succeeded" });

    const res = await POST(webhookRequest(body, sign(body)));
    expect(res.status).toBe(501);
  });

  it("rejects malformed JSON even with a valid signature", async () => {
    const body = "{not json";
    const res = await POST(webhookRequest(body, sign(body)));
    expect(res.status).toBe(400);
  });

  it("rejects a payload that fails schema validation", async () => {
    const body = JSON.stringify({ object: { id: "payment-1" } });
    const res = await POST(webhookRequest(body, sign(body)));
    expect(res.status).toBe(400);
  });

  it("completes a payment on a succeeded event", async () => {
    const body = JSON.stringify({
      eventId: "evt-complete-1",
      status: "succeeded",
      object: { id: "payment-1", transactionId: "txn-1", metadata: { paymentId: "payment-1" } },
    });

    const res = await POST(webhookRequest(body, sign(body)));
    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload).toEqual({ received: true, status: "completed" });
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
  });

  it("ignores a duplicate event (idempotency)", async () => {
    const body = JSON.stringify({
      eventId: "evt-duplicate-1",
      status: "succeeded",
      object: { id: "payment-1", transactionId: "txn-1", metadata: { paymentId: "payment-1" } },
    });

    const first = await POST(webhookRequest(body, sign(body)));
    expect(first.status).toBe(200);

    const second = await POST(webhookRequest(body, sign(body)));
    expect(second.status).toBe(200);

    const payload = await second.json();
    expect(payload.idempotent).toBe(true);
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when the referenced payment does not exist", async () => {
    mockDb.payment.findFirst.mockResolvedValue(null);
    const body = JSON.stringify({
      eventId: "evt-missing-1",
      status: "succeeded",
      object: { id: "payment-missing", transactionId: "txn-x" },
    });

    const res = await POST(webhookRequest(body, sign(body)));
    expect(res.status).toBe(404);
  });

  it("does nothing for a pending status event", async () => {
    const body = JSON.stringify({
      eventId: "evt-pending-1",
      status: "pending",
      object: { id: "payment-1" },
    });

    const res = await POST(webhookRequest(body, sign(body)));
    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload.status).toBe("pending");
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("marks the payment failed on a terminal non-completed status", async () => {
    const body = JSON.stringify({
      eventId: "evt-failed-1",
      status: "canceled",
      object: { id: "payment-1" },
    });

    const res = await POST(webhookRequest(body, sign(body)));
    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload.status).toBe("failed");
    expect(mockDb.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "payment-1", status: "pending" },
      data: { status: "failed" },
    });
  });

  it("refunds the payment and cancels the enrolment on a refund event", async () => {
    const body = JSON.stringify({
      eventId: "evt-refund-1",
      event: "refund.succeeded",
      status: "succeeded",
      object: { id: "refund-1", payment_id: "payment-1", status: "succeeded" },
    });

    const res = await POST(webhookRequest(body, sign(body)));
    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload).toEqual({ received: true, status: "refunded" });
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("ignores a refund event that is not terminal", async () => {
    const body = JSON.stringify({
      eventId: "evt-refund-2",
      event: "refund.pending",
      status: "pending",
      object: { id: "refund-2", payment_id: "payment-1", status: "pending" },
    });

    const res = await POST(webhookRequest(body, sign(body)));
    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload.status).toBe("pending");
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("stays idempotent when the payment was already completed", async () => {
    mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        payment: {
          findUnique: vi.fn().mockResolvedValue(completedPayment),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        course: { updateMany: vi.fn(), update: vi.fn() },
        enrollment: { upsert: vi.fn(), updateMany: vi.fn() },
      }),
    );

    const body = JSON.stringify({
      eventId: "evt-already-1",
      status: "succeeded",
      object: { id: "payment-1", transactionId: "txn-1", metadata: { paymentId: "payment-1" } },
    });

    const res = await POST(webhookRequest(body, sign(body)));
    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload.status).toBe("completed");
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});
