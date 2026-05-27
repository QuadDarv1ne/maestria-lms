import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  sadd: vi.fn(),
  expire: vi.fn(),
  smembers: vi.fn(),
  pipeline: vi.fn(() => ({
    exec: vi.fn().mockResolvedValue([]),
    sadd: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
  })),
  on: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock("ioredis", () => ({
  default: vi.fn(() => mockRedis),
}));

vi.mock("@/lib/logger", () => ({
  log: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Set REDIS_URL before importing cache module
process.env.REDIS_URL = "redis://localhost:6379";

describe("Cache utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state between tests
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateCacheKey", () => {
    it("should generate consistent cache keys", async () => {
      const { generateCacheKey } = await import("@/lib/cache");

      const key1 = generateCacheKey("courses", { page: 1, limit: 10, sort: "new" });
      const key2 = generateCacheKey("courses", { page: 1, limit: 10, sort: "new" });
      const key3 = generateCacheKey("courses", { limit: 10, page: 1, sort: "new" });

      expect(key1).toBe(key2);
      expect(key1).toBe(key3); // Order shouldn't matter
    });

    it("should generate different keys for different params", async () => {
      const { generateCacheKey } = await import("@/lib/cache");

      const key1 = generateCacheKey("courses", { page: 1 });
      const key2 = generateCacheKey("courses", { page: 2 });

      expect(key1).not.toBe(key2);
    });
  });

  describe("createCacheHeaders", () => {
    it("should create public cache headers", async () => {
      const { createCacheHeaders } = await import("@/lib/cache");

      const headers = createCacheHeaders(300, true);

      expect(headers["Cache-Control"]).toContain("public");
      expect(headers["Cache-Control"]).toContain("max-age=300");
    });

    it("should create private cache headers", async () => {
      const { createCacheHeaders } = await import("@/lib/cache");

      const headers = createCacheHeaders(300, false);

      expect(headers["Cache-Control"]).toContain("private");
    });

    it("should add stale-while-revalidate when specified", async () => {
      const { createCacheHeaders } = await import("@/lib/cache");

      const headers = createCacheHeaders(300, true, 600);

      expect(headers["Cache-Control"]).toContain("stale-while-revalidate=600");
    });
  });

  describe("cache operations", () => {
    it("should set and get from memory cache when Redis fails", async () => {
      // Force Redis to fail
      process.env.REDIS_URL = "";
      vi.resetModules();

      const { cacheSet, cacheGet } = await import("@/lib/cache");

      await cacheSet("test-key", { data: "test" }, { ttl: 60000 });
      const result = await cacheGet("test-key");

      expect(result).toEqual({ data: "test" });
    });

    it("should invalidate by tag", async () => {
      process.env.REDIS_URL = "";
      vi.resetModules();

      const { cacheInvalidateByTag } = await import("@/lib/cache");

      // Memory cache doesn't support tags, but should not throw
      const result = await cacheInvalidateByTag("articles");
      expect(result).toBe(false);
    });
  });
});
