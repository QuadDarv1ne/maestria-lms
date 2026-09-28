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
  connect: vi.fn().mockResolvedValue(undefined),
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

const originalRedisUrl = process.env.REDIS_URL;

describe("Cache utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Assume a configured Redis by default; tests that need the memory path
    // override REDIS_URL explicitly. It is restored in afterEach so the
    // mutation cannot leak into other test files sharing the worker.
    process.env.REDIS_URL = "redis://localhost:6379";
    // Reset module state between tests
    vi.resetModules();
  });

  afterEach(() => {
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedisUrl;
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

    it("should not throw when invalidating a tag with no cached entries", async () => {
      process.env.REDIS_URL = "";
      vi.resetModules();

      const { cacheInvalidateByTag } = await import("@/lib/cache");

      const result = await cacheInvalidateByTag("articles");
      expect(result).toBe(false);
    });

    it("invalidates memory-cached entries by tag", async () => {
      process.env.REDIS_URL = "";
      vi.resetModules();

      const { cacheSet, cacheGet, cacheInvalidateByTag } = await import("@/lib/cache");

      await cacheSet("tagged-key", { data: "tagged" }, { ttl: 60000, tags: ["articles"] });
      await cacheSet("other-key", { data: "other" }, { ttl: 60000, tags: ["courses"] });

      const removed = await cacheInvalidateByTag("articles");

      expect(removed).toBe(true);
      expect(await cacheGet("tagged-key")).toBeNull();
      expect(await cacheGet("other-key")).toEqual({ data: "other" });
    });

    it("stores redis tag members under the same prefix as the entries (regression)", async () => {
      vi.resetModules();
      mockRedis.pipeline.mockClear();
      // afterEach restoreAllMocks() wipes implementations of the shared mocks;
      // re-establish the ones this test relies on.
      mockRedis.connect.mockResolvedValue(undefined);

      const setPipeline = {
        sadd: vi.fn(),
        expire: vi.fn(),
        del: vi.fn(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValueOnce(setPipeline);

      const { cacheSet, cacheInvalidateByTag } = await import("@/lib/cache");

      await cacheSet("k1", { x: 1 }, { ttl: 60000, tags: ["articles"] });

      expect(setPipeline.sadd).toHaveBeenCalledWith("cache:tag:articles", "cache:k1");
      expect(setPipeline.expire).toHaveBeenCalledWith("cache:tag:articles", 60);

      const invalidatePipeline = {
        sadd: vi.fn(),
        expire: vi.fn(),
        del: vi.fn(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValueOnce(invalidatePipeline);
      mockRedis.smembers.mockResolvedValueOnce(["cache:k1"]);

      const removed = await cacheInvalidateByTag("articles");

      expect(removed).toBe(true);
      expect(invalidatePipeline.del).toHaveBeenCalledWith("cache:k1");
    });
  });
});
