/**
 * Unit tests for the JWT callback cache (src/lib/jwt-user-cache.ts).
 *
 * The cache exists to avoid a DB read per authenticated request, which means a
 * stale entry is a real risk: it must expire, it must be droppable on demand,
 * and it must not grow without bound.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  getJwtUserCache,
  setJwtUserCache,
  invalidateJwtUserCache,
  JWT_CACHE_TTL,
} from "@/lib/jwt-user-cache";

const ENTRY = { role: "student", isActive: true, sessionVersion: 0 };

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("jwt-user-cache", () => {
  it("returns null for a user that was never cached", () => {
    expect(getJwtUserCache("never-cached")).toBeNull();
  });

  it("returns the stored snapshot", () => {
    setJwtUserCache("u1", ENTRY);

    expect(getJwtUserCache("u1")).toEqual(ENTRY);
  });

  it("keeps the version so a stale token can be detected", () => {
    setJwtUserCache("u2", { role: "admin", isActive: true, sessionVersion: 4 });

    expect(getJwtUserCache("u2")?.sessionVersion).toBe(4);
  });

  it("expires an entry once the TTL has passed", () => {
    vi.useFakeTimers();
    setJwtUserCache("u3", ENTRY);

    vi.advanceTimersByTime(JWT_CACHE_TTL + 1);

    expect(getJwtUserCache("u3")).toBeNull();
  });

  it("keeps an entry inside the TTL window", () => {
    vi.useFakeTimers();
    setJwtUserCache("u4", ENTRY);

    vi.advanceTimersByTime(JWT_CACHE_TTL - 1);

    expect(getJwtUserCache("u4")).toEqual(ENTRY);
  });

  it("drops an entry on demand", () => {
    setJwtUserCache("u5", ENTRY);
    invalidateJwtUserCache("u5");

    expect(getJwtUserCache("u5")).toBeNull();
  });

  it("overwrites an existing entry rather than duplicating it", () => {
    setJwtUserCache("u6", ENTRY);
    setJwtUserCache("u6", { role: "admin", isActive: true, sessionVersion: 9 });

    expect(getJwtUserCache("u6")?.role).toBe("admin");
    expect(getJwtUserCache("u6")?.sessionVersion).toBe(9);
  });

  it("is a no-op when invalidating an unknown user", () => {
    expect(() => invalidateJwtUserCache("unknown")).not.toThrow();
  });

  it("stays bounded when many users are cached", () => {
    for (let i = 0; i < 600; i++) {
      setJwtUserCache(`bulk-${i}`, ENTRY);
    }

    // The oldest insertions are evicted, the newest survive.
    expect(getJwtUserCache("bulk-0")).toBeNull();
    expect(getJwtUserCache("bulk-599")).toEqual(ENTRY);
  });
});
