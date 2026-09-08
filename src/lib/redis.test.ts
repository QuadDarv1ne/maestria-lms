import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getRedisClient", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEnv !== undefined) {
      process.env.REDIS_URL = originalEnv;
    } else {
      delete process.env.REDIS_URL;
    }
  });

  it("returns null when REDIS_URL is not configured", async () => {
    const { getRedisClient } = await import("./redis");
    const client = getRedisClient();
    expect(client).toBeNull();
  });

  it("returns the same client instance on subsequent calls (singleton)", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const { getRedisClient } = await import("./redis");
    const client1 = getRedisClient();
    const client2 = getRedisClient();

    expect(client1).toBe(client2);
  });
});
