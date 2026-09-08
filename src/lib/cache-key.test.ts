import { describe, it, expect } from "vitest";
import { generateCacheKey, createCacheHeaders, stopMemoryCacheCleanup } from "./cache";

describe("generateCacheKey", () => {
  it("generates a deterministic key for the same params", () => {
    const key1 = generateCacheKey("courses", { page: 1, limit: 10 });
    const key2 = generateCacheKey("courses", { page: 1, limit: 10 });
    expect(key1).toBe(key2);
  });

  it("produces different keys for different params", () => {
    const key1 = generateCacheKey("courses", { page: 1, limit: 10 });
    const key2 = generateCacheKey("courses", { page: 2, limit: 10 });
    expect(key1).not.toBe(key2);
  });

  it("is order-independent for params", () => {
    const key1 = generateCacheKey("search", { q: "test", page: 1 });
    const key2 = generateCacheKey("search", { page: 1, q: "test" });
    expect(key1).toBe(key2);
  });

  it("includes the prefix in the key", () => {
    const key = generateCacheKey("myPrefix", { a: 1 });
    expect(key).toMatch(/^myPrefix:/);
  });

  it("produces a key with reasonable length (prefix + base64 substring)", () => {
    const key = generateCacheKey("courses", {
      page: 1,
      limit: 20,
      category: "web-development",
      search: "typescript advanced course",
    });
    // prefix:5 + : + 32 base64 chars = ~38 chars
    expect(key.length).toBeGreaterThan(20);
    expect(key.length).toBeLessThan(100);
  });

  it("handles string and boolean params", () => {
    const key = generateCacheKey("filter", {
      freeOnly: true,
      category: "python",
      level: "beginner",
    });
    expect(key).toBeDefined();
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });
});

describe("createCacheHeaders", () => {
  it("returns public Cache-Control with max-age", () => {
    const headers = createCacheHeaders(300);
    expect(headers["Cache-Control"]).toBe("public, max-age=300");
  });

  it("returns private Cache-Control when isPublic is false", () => {
    const headers = createCacheHeaders(300, false);
    expect(headers["Cache-Control"]).toBe("private, max-age=300");
  });

  it("includes stale-while-revalidate when provided", () => {
    const headers = createCacheHeaders(300, true, 60);
    expect(headers["Cache-Control"]).toBe("public, max-age=300, stale-while-revalidate=60");
  });

  it("does not include stale-while-revalidate when not provided", () => {
    const headers = createCacheHeaders(300, true);
    expect(headers["Cache-Control"]).not.toContain("stale-while-revalidate");
  });

  it("handles zero max-age", () => {
    const headers = createCacheHeaders(0);
    expect(headers["Cache-Control"]).toBe("public, max-age=0");
  });
});

describe("stopMemoryCacheCleanup", () => {
  it("can be called without errors", () => {
    expect(() => stopMemoryCacheCleanup()).not.toThrow();
  });
});
