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

  it("produces a key that encodes the full parameter string", () => {
    const key = generateCacheKey("courses", {
      page: 1,
      limit: 20,
      category: "web-development",
      search: "typescript advanced course",
    });
    // The full JSON parameter string is encoded — no truncation.
    expect(key.length).toBeGreaterThan(20);
    expect(key.length).toBeLessThan(400);
  });

  it("keeps trailing parameters significant (collision regression)", () => {
    // Sorted article-list params: category, featured, limit, page, search,
    // sortBy, tag. page/limit/search/sortBy/tag all live beyond the first
    // 24 bytes of the JSON and used to be ignored by the truncated key.
    const base = {
      category: null,
      featured: null,
      limit: 12,
      page: 1,
      search: null,
      sortBy: null,
      tag: null,
    };
    const baseKey = generateCacheKey("articles:list", base);
    const variants = [
      generateCacheKey("articles:list", { ...base, page: 2 }),
      generateCacheKey("articles:list", { ...base, search: "java" }),
      generateCacheKey("articles:list", { ...base, limit: 50 }),
      generateCacheKey("articles:list", { ...base, sortBy: "popular" }),
      generateCacheKey("articles:list", { ...base, tag: "sql" }),
    ];
    for (const key of variants) {
      expect(key).not.toBe(baseKey);
    }
    expect(new Set(variants).size).toBe(variants.length);
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
