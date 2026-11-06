// @vitest-environment node
/**
 * Route-level tests for POST /api/web-vitals (browser telemetry beacon).
 *
 * The endpoint is public and used via `navigator.sendBeacon()`, so it must
 * always answer 204 and never throw — the browser does not read the response.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRecord, mockHandleApiError } = vi.hoisted(() => ({
  mockRecord: vi.fn(),
  mockHandleApiError: vi.fn(),
}));

vi.mock("@/lib/web-vitals", () => ({
  MAX_BATCH: 20,
  recordWebVitals: (samples: unknown[]) => mockRecord(samples),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: async () => ({ response: null, headers: {} }),
  RATE_LIMITS: { webVitals: { windowMs: 60_000, maxRequests: 60 } },
}));
vi.mock("@/lib/api-errors", () => ({
  handleApiError: () => mockHandleApiError(),
}));
vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { POST } from "@/app/api/web-vitals/route";

function post(body: string) {
  return new NextRequest("http://localhost/api/web-vitals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRecord.mockResolvedValue(1);
  mockHandleApiError.mockReturnValue(
    new Response(JSON.stringify({ error: "internal" }), { status: 500 }),
  );
});

describe("POST /api/web-vitals", () => {
  it("accepts a { samples: [...] } envelope", async () => {
    const response = await POST(
      post(JSON.stringify({ samples: [{ name: "LCP", value: 1200, path: "/" }] })),
    );

    expect(response.status).toBe(204);
    expect(mockRecord).toHaveBeenCalledWith([{ name: "LCP", value: 1200, path: "/" }]);
  });

  it("accepts a bare array body", async () => {
    const response = await POST(post(JSON.stringify([{ name: "CLS", value: 0.04 }])));

    expect(response.status).toBe(204);
    expect(mockRecord).toHaveBeenCalledWith([{ name: "CLS", value: 0.04 }]);
  });

  it("answers 204 and stores nothing for an empty batch", async () => {
    const response = await POST(post(JSON.stringify({ samples: [] })));

    expect(response.status).toBe(204);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("answers 204 for invalid JSON instead of failing the beacon", async () => {
    const response = await POST(post("{not json"));

    expect(response.status).toBe(204);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("answers 204 when the body has no samples array", async () => {
    const response = await POST(post(JSON.stringify({ foo: "bar" })));

    expect(response.status).toBe(204);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("truncates an oversized batch to MAX_BATCH", async () => {
    const samples = Array.from({ length: 50 }, () => ({ name: "TTFB", value: 100 }));

    const response = await POST(post(JSON.stringify({ samples })));

    expect(response.status).toBe(204);
    const passed = mockRecord.mock.calls[0][0] as unknown[];
    expect(passed).toHaveLength(20);
  });

  it("still answers 204 when the storage layer accepts nothing", async () => {
    mockRecord.mockResolvedValue(0);

    const response = await POST(post(JSON.stringify({ samples: [{ name: "INP", value: 90 }] })));

    expect(response.status).toBe(204);
  });
});
