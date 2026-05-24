import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStore: Record<string, string> = {};

vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn((path: string) => true),
    readFileSync: vi.fn((path: string) => {
      const fileName = path.split("/").pop()?.replace(".json", "") || "";
      return mockStore[fileName] || "{}";
    }),
    writeFileSync: vi.fn((path: string, content: string) => {
      const fileName = path.split("/").pop()?.replace(".json", "") || "";
      mockStore[fileName] = content;
    }),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(() => []),
  },
}));

import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStore).forEach(key => delete mockStore[key]);
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

  it("should reject private IP spoofing", () => {
    const limiter = rateLimit("test-spoof", { windowMs: 60_000, maxRequests: 10 });
    const request = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });

    limiter(request);
    const response = limiter(request);

    expect(response).toBeNull();
  });
});

describe("RATE_LIMITS", () => {
  it("should have expected route configurations", () => {
    expect(RATE_LIMITS.register.maxRequests).toBe(5);
    expect(RATE_LIMITS.login.maxRequests).toBe(10);
    expect(RATE_LIMITS.forgotPassword.maxRequests).toBe(3);
  });
});
