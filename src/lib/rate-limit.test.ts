import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("should allow requests within limit", () => {
    const limiter = rateLimit("test", { windowMs: 60_000, maxRequests: 5 });
    const request = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.50" },
    });

    for (let i = 0; i < 5; i++) {
      const response = limiter(request);
      expect(response).toBeNull();
    }
  });

  it("should block requests exceeding limit", () => {
    const limiter = rateLimit("test-block", { windowMs: 60_000, maxRequests: 2 });
    const request = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.51" },
    });

    limiter(request);
    limiter(request);
    const response = limiter(request);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
  });

  it("should return Retry-After header when blocked", () => {
    const limiter = rateLimit("test-retry", { windowMs: 60_000, maxRequests: 1 });
    const request = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.52" },
    });

    limiter(request);
    const response = limiter(request);

    expect(response?.headers.get("Retry-After")).toBeDefined();
  });

  it("should return X-RateLimit-* headers when blocked", () => {
    const limiter = rateLimit("test-headers", { windowMs: 60_000, maxRequests: 1 });
    const request = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.53" },
    });

    limiter(request);
    const response = limiter(request);

    expect(response?.headers.get("X-RateLimit-Limit")).toBe("1");
    expect(response?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response?.headers.get("X-RateLimit-Reset")).toBeDefined();
  });

  it("should allow requests from spoofed private IPs (mapped to anonymous bucket)", () => {
    const limiter = rateLimit("test-spoof", { windowMs: 60_000, maxRequests: 10 });
    const request = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });

    limiter(request);
    const response = limiter(request);

    expect(response).toBeNull();
  });

  it("should share rate-limit bucket across different spoofed private IPs", () => {
    const limiter = rateLimit("test-spoof-shared", { windowMs: 60_000, maxRequests: 2 });

    // Different private IPs should share the same bucket
    const req1 = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    const req2 = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "192.168.1.1" },
    });
    const req3 = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "127.0.0.1" },
    });

    // First two requests succeed (from any private IP)
    expect(limiter(req1)).toBeNull();
    expect(limiter(req2)).toBeNull();

    // Third request from a different private IP should be blocked (shared bucket)
    const response = limiter(req3);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
  });

  it("should use per-user rate limiting when userId is provided", () => {
    const limiter = rateLimit("test-user", { windowMs: 60_000, maxRequests: 2 });
    const request = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.60" },
    });

    // Same IP, different users should have separate buckets
    limiter(request, "user-1");
    limiter(request, "user-1");
    expect(limiter(request, "user-1")).not.toBeNull(); // user-1 exceeded

    // user-2 should still be allowed (separate bucket)
    expect(limiter(request, "user-2")).toBeNull();
    expect(limiter(request, "user-2")).toBeNull();
    expect(limiter(request, "user-2")).not.toBeNull(); // user-2 exceeded
  });

  it("should isolate rate limits between different routeIds", () => {
    const limiterA = rateLimit("route-a", { windowMs: 60_000, maxRequests: 1 });
    const limiterB = rateLimit("route-b", { windowMs: 60_000, maxRequests: 1 });
    const request = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.70" },
    });

    // Exhaust limit on route-a
    limiterA(request);
    expect(limiterA(request)).not.toBeNull();

    // route-b should still allow requests
    expect(limiterB(request)).toBeNull();
  });
});

describe("RATE_LIMITS", () => {
  it("should have expected route configurations", () => {
    expect(RATE_LIMITS.register.maxRequests).toBe(5);
    expect(RATE_LIMITS.login.maxRequests).toBe(10);
    expect(RATE_LIMITS.forgotPassword.maxRequests).toBe(3);
    expect(RATE_LIMITS.resetPassword.maxRequests).toBe(5);
  });

  it("should have SSE rate limit configuration", () => {
    expect(RATE_LIMITS.sse).toBeDefined();
    expect(RATE_LIMITS.sse.maxRequests).toBe(5);
  });
});
