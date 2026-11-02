// @vitest-environment node
/**
 * Route-level tests for POST /api/payments/reconcile: the cron endpoint must be
 * disabled without a configured secret and reject every unauthenticated call.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockEnv, mockReconcile } = vi.hoisted(() => ({
  mockEnv: { paymentReconcileSecret: "reconcile-secret" as string | undefined },
  mockReconcile: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
}));

vi.mock("@/lib/payments/reconcile", () => ({
  reconcilePendingPayments: mockReconcile,
}));

import { POST } from "@/app/api/payments/reconcile/route";

const SECRET = "reconcile-secret";

function postRequest(
  body?: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest("http://localhost/api/payments/reconcile", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const summary = {
  scanned: 3,
  completed: 1,
  failed: 0,
  pending: 1,
  skipped: 1,
  unknown: 0,
  errors: 0,
  durationMs: 12,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.paymentReconcileSecret = SECRET;
  mockReconcile.mockResolvedValue(summary);
});

describe("POST /api/payments/reconcile — authentication", () => {
  it("returns 503 when no secret is configured", async () => {
    mockEnv.paymentReconcileSecret = undefined;

    const response = await POST(postRequest({}, { authorization: `Bearer ${SECRET}` }));

    expect(response.status).toBe(503);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("rejects a request without credentials", async () => {
    const response = await POST(postRequest());

    expect(response.status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret of a different length", async () => {
    const response = await POST(postRequest({}, { authorization: "Bearer short" }));

    expect(response.status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret of the same length", async () => {
    const wrong = "x".repeat(SECRET.length);
    const response = await POST(postRequest({}, { "x-reconcile-secret": wrong }));

    expect(response.status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });
});

describe("POST /api/payments/reconcile — authorized run", () => {
  it("runs reconciliation with Bearer auth and returns the summary", async () => {
    const response = await POST(
      postRequest({ minAgeMinutes: 5, batchSize: 10 }, { authorization: `Bearer ${SECRET}` }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, ...summary });
    expect(mockReconcile).toHaveBeenCalledWith({ minAgeMinutes: 5, batchSize: 10 });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("accepts X-Reconcile-Secret and an empty body", async () => {
    const response = await POST(
      postRequest(undefined, { "x-reconcile-secret": SECRET }),
    );

    expect(response.status).toBe(200);
    expect(mockReconcile).toHaveBeenCalledWith({});
  });

  it("rejects invalid JSON", async () => {
    const request = new NextRequest("http://localhost/api/payments/reconcile", {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
      body: "{not json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("rejects out-of-range options", async () => {
    const response = await POST(
      postRequest({ batchSize: 9999 }, { authorization: `Bearer ${SECRET}` }),
    );

    expect(response.status).toBe(400);
    expect(mockReconcile).not.toHaveBeenCalled();
  });
});
