/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { generateRequestId, logApiRequest, withApiLogging } from "@/lib/api-logging";

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { log } from "@/lib/logger";

const mockLog = vi.mocked(log);

function makeRequest(path = "/api/courses"): NextRequest {
  return new NextRequest(new URL(`https://example.com${path}?token=secret&page=2`));
}

describe("generateRequestId", () => {
  it("should return an 8-character string", () => {
    const id = generateRequestId();
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  it("should return unique ids across calls", () => {
    expect(generateRequestId()).not.toBe(generateRequestId());
  });
});

describe("logApiRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should log as info for 2xx", () => {
    logApiRequest({ method: "GET", path: "/api/courses", statusCode: 200, durationMs: 12, requestId: "abc" });
    expect(mockLog.info).toHaveBeenCalled();
    expect(mockLog.error).not.toHaveBeenCalled();
    expect(mockLog.warn).not.toHaveBeenCalled();
  });

  it("should log as warn for 4xx", () => {
    logApiRequest({ method: "POST", path: "/api/courses", statusCode: 403, durationMs: 5, requestId: "abc" });
    expect(mockLog.warn).toHaveBeenCalled();
    expect(mockLog.info).not.toHaveBeenCalled();
  });

  it("should log as error for 5xx", () => {
    logApiRequest({ method: "GET", path: "/api/courses", statusCode: 500, durationMs: 8, requestId: "abc" });
    expect(mockLog.error).toHaveBeenCalled();
    expect(mockLog.info).not.toHaveBeenCalled();
  });

  it("should omit queryParams from context when empty", () => {
    logApiRequest({ method: "GET", path: "/api/courses", statusCode: 200, durationMs: 1, requestId: "abc" });
    const ctx = mockLog.info.mock.calls[0][1] as Record<string, unknown>;
    expect(ctx.queryParams).toBeUndefined();
  });
});

describe("withApiLogging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should attach X-Request-Id and X-Response-Time headers on success", async () => {
    const handler = async () => NextResponse.json({ ok: true });
    const wrapped = withApiLogging(handler);
    const req = makeRequest();
    const res = await wrapped(req, { params: Promise.resolve({}) });

    expect(res.headers.get("X-Request-Id")).toMatch(/^[0-9a-f]{8}$/);
    expect(res.headers.get("X-Response-Time")).toMatch(/ms$/);
    expect(mockLog.info).toHaveBeenCalled();
  });

  it("should read user headers from response and pass into log context", async () => {
    const handler = async () => {
      return new NextResponse(JSON.stringify({ ok: true }), {
        headers: { "X-User-Id": "u-1", "X-User-Role": "admin" },
      });
    };
    const wrapped = withApiLogging(handler);
    const res = await wrapped(makeRequest(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const ctx = mockLog.info.mock.calls[0][1] as Record<string, unknown>;
    expect(ctx.userId).toBe("u-1");
    expect(ctx.userRole).toBe("admin");
  });

  it("should redact sensitive query params and return a 200 response", async () => {
    const handler = async () => NextResponse.json({ ok: true });
    const wrapped = withApiLogging(handler);
    await wrapped(makeRequest(), { params: Promise.resolve({}) });
    const ctx = mockLog.info.mock.calls[0][1] as Record<string, unknown>;
    const qp = ctx.queryParams as Record<string, string>;
    expect(qp.token).toBe("[REDACTED]");
    expect(qp.page).toBe("2");
  });

  it("should log error and return 500 when handler throws", async () => {
    const handler = async () => {
      throw new Error("boom");
    };
    const wrapped = withApiLogging(handler);
    const res = await wrapped(makeRequest(), { params: Promise.resolve({}) });

    expect(res.status).toBe(500);
    expect(res.headers.get("X-Request-Id")).toMatch(/^[0-9a-f]{8}$/);
    expect(mockLog.error).toHaveBeenCalled();
  });

  it("should preserve the handler status code on success", async () => {
    const handler = async () => NextResponse.json({ ok: true }, { status: 201 });
    const wrapped = withApiLogging(handler);
    const res = await wrapped(makeRequest(), { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
  });
});
