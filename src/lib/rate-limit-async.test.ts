/**
 * Тесты асинхронной части rate-limit: rateLimitAsync (Redis + fallback
 * на память) и addRateLimitHeaders. Синхронный rateLimit покрыт в
 * rate-limit.test.ts — здесь только Redis-путь и хелпер заголовков.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type Redis from "ioredis";

const { logWarn, evalMock, getRedisClientMock } = vi.hoisted(() => ({
  logWarn: vi.fn(),
  evalMock: vi.fn(),
  getRedisClientMock: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: logWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/redis", () => ({
  getRedisClient: getRedisClientMock,
}));

import {
  rateLimitAsync,
  addRateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/rate-limit";

function makeRequest(ip: string): Request {
  return new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("rateLimitAsync (Redis path)", () => {
  beforeEach(() => {
    logWarn.mockClear();
    evalMock.mockReset();
    getRedisClientMock.mockReset();
    getRedisClientMock.mockReturnValue({
      eval: evalMock,
    } as unknown as Redis);
  });

  it("returns headers and no response when under the limit", async () => {
    evalMock.mockResolvedValue([1, 60_000]);

    const { response, headers } = await rateLimitAsync(
      "rla-redis-ok",
      makeRequest("203.0.113.10"),
      { userId: "u-redis", maxRequests: 5 },
    );

    expect(response).toBeNull();
    expect(headers["X-RateLimit-Limit"]).toBe("5");
    expect(headers["X-RateLimit-Remaining"]).toBe("4");
    expect(Number(headers["X-RateLimit-Reset"])).toBeGreaterThan(Date.now() - 1000);

    // EVAL вызывается атомарно: script, numKeys, ключ, windowMs
    expect(evalMock).toHaveBeenCalledTimes(1);
    const evalArgs = evalMock.mock.calls[0];
    expect(evalArgs[0]).toContain("INCR");
    expect(evalArgs[1]).toBe(1);
    expect(String(evalArgs[2])).toBe("ratelimit:user:u-redis:rla-redis-ok");
    expect(evalArgs[3]).toBe("60000");
  });

  it("returns 429 when count exceeds maxRequests", async () => {
    evalMock.mockResolvedValue([6, 30_000]);

    const { response, headers } = await rateLimitAsync(
      "rla-redis-limited",
      makeRequest("203.0.113.11"),
      { maxRequests: 5 },
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
    const retryAfter = response?.headers.get("Retry-After");
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
  });

  it("falls back to memory with a warning when redis eval fails", async () => {
    // checkRedisLimit оборачивает ошибку ("Redis pipeline error in ..."),
    // rateLimitAsync ловит её и переключается на memory-лимитер
    evalMock.mockRejectedValue(new Error("connection refused"));

    const { response, headers } = await rateLimitAsync(
      "rla-redis-fallback",
      makeRequest("203.0.113.13"),
      { maxRequests: 5 },
    );

    expect(response).toBeNull();
    expect(headers["X-RateLimit-Limit"]).toBe("5");
    expect(headers["X-RateLimit-Remaining"]).toBe("4");
    expect(logWarn).toHaveBeenCalledTimes(1);
    expect(String(logWarn.mock.calls[0][0])).toContain("falling back to memory");
    const errorContext = logWarn.mock.calls[0][1] as { error?: string };
    expect(errorContext.error).toBe(
      "Redis pipeline error in rate-limit check: connection refused",
    );
  });
});

describe("rateLimitAsync (memory fallback)", () => {
  beforeEach(() => {
    logWarn.mockClear();
    getRedisClientMock.mockReset();
    getRedisClientMock.mockReturnValue(null);
  });

  it("allows requests within the limit and returns headers", async () => {
    for (let i = 0; i < 2; i++) {
      const { response, headers } = await rateLimitAsync(
        "rla-mem-ok",
        makeRequest("203.0.113.20"),
        { maxRequests: 2 },
      );
      expect(response).toBeNull();
      expect(headers["X-RateLimit-Limit"]).toBe("2");
      expect(Number(headers["X-RateLimit-Remaining"])).toBe(1 - i);
    }
  });

  it("returns 429 after exhausting the limit", async () => {
    const ip = "203.0.113.21";
    await rateLimitAsync("rla-mem-block", makeRequest(ip), { maxRequests: 2 });
    await rateLimitAsync("rla-mem-block", makeRequest(ip), { maxRequests: 2 });

    const { response, headers } = await rateLimitAsync(
      "rla-mem-block",
      makeRequest(ip),
      { maxRequests: 2 },
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
  });

  it("isolates buckets per userId", async () => {
    const request = makeRequest("203.0.113.22");

    await rateLimitAsync("rla-mem-user", request, { userId: "user-1", maxRequests: 2 });
    await rateLimitAsync("rla-mem-user", request, { userId: "user-1", maxRequests: 2 });
    const exhausted = await rateLimitAsync(
      "rla-mem-user",
      request,
      { userId: "user-1", maxRequests: 2 },
    );
    expect(exhausted.response).not.toBeNull();

    // Другой пользователь — свой bucket
    const other = await rateLimitAsync(
      "rla-mem-user",
      request,
      { userId: "user-2", maxRequests: 2 },
    );
    expect(other.response).toBeNull();
  });

  it("isolates buckets per routeId", async () => {
    const request = makeRequest("203.0.113.23");
    await rateLimitAsync("rla-mem-route-a", request, { maxRequests: 1 });
    const blocked = await rateLimitAsync(
      "rla-mem-route-a",
      request,
      { maxRequests: 1 },
    );
    expect(blocked.response).not.toBeNull();

    const otherRoute = await rateLimitAsync(
      "rla-mem-route-b",
      request,
      { maxRequests: 1 },
    );
    expect(otherRoute.response).toBeNull();
  });
});

describe("addRateLimitHeaders", () => {
  beforeEach(() => {
    getRedisClientMock.mockReset();
    getRedisClientMock.mockReturnValue(null);
  });

  it("uses RATE_LIMITS config for a known routeId (login)", () => {
    const headers = new Headers();
    addRateLimitHeaders(headers, "login", makeRequest("203.0.113.30"));

    expect(headers.get("X-RateLimit-Limit")).toBe("10");
    expect(headers.get("X-RateLimit-Remaining")).toBe("9");
    expect(headers.get("X-RateLimit-Window")).toBe("60000");
    expect(Number(headers.get("X-RateLimit-Reset"))).toBeGreaterThan(
      Date.now() - 1000,
    );
  });

  it("increments the counter on subsequent calls", () => {
    const request = makeRequest("203.0.113.31");
    const first = new Headers();
    addRateLimitHeaders(first, "register", request);
    const second = new Headers();
    addRateLimitHeaders(second, "register", request);

    expect(first.get("X-RateLimit-Limit")).toBe("5");
    expect(first.get("X-RateLimit-Remaining")).toBe("4");
    expect(second.get("X-RateLimit-Remaining")).toBe("3");
  });

  it("separates user buckets from ip buckets", () => {
    const request = makeRequest("203.0.113.32");

    const userHeaders = new Headers();
    addRateLimitHeaders(userHeaders, "profile", request, "user-x");
    expect(userHeaders.get("X-RateLimit-Remaining")).toBe("19");

    // IP-bucket не затронут user-запросами
    const ipHeaders = new Headers();
    addRateLimitHeaders(ipHeaders, "profile", request);
    expect(ipHeaders.get("X-RateLimit-Remaining")).toBe("19");
  });

  it("falls back to default config for unknown routeId", () => {
    const headers = new Headers();
    addRateLimitHeaders(headers, "no-such-route", makeRequest("203.0.113.33"));

    expect(headers.get("X-RateLimit-Limit")).toBe("30");
    expect(headers.get("X-RateLimit-Remaining")).toBe("29");
  });
});

describe("RATE_LIMITS config", () => {
  it("every route has a 60s window and positive maxRequests", () => {
    for (const [routeId, config] of Object.entries(RATE_LIMITS)) {
      expect(config.windowMs, routeId).toBe(60_000);
      expect(config.maxRequests, routeId).toBeGreaterThan(0);
    }
  });

  it("defines the documented critical routes", () => {
    for (const routeId of [
      "register",
      "forgotPassword",
      "resetPassword",
      "login",
      "admin",
      "upload",
      "payments",
      "enrollment",
      "sse",
      "default",
    ]) {
      expect(RATE_LIMITS).toHaveProperty(routeId);
    }
  });
});
