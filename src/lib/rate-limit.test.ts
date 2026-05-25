import { describe, it, expect, beforeEach, vi } from "vitest";

import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
});

describe("RATE_LIMITS", () => {
  it("should have expected route configurations", () => {
    expect(RATE_LIMITS.register.maxRequests).toBe(5);
    expect(RATE_LIMITS.login.maxRequests).toBe(10);
    expect(RATE_LIMITS.forgotPassword.maxRequests).toBe(3);
    expect(RATE_LIMITS.resetPassword.maxRequests).toBe(5);
  });
});
