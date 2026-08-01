import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearEnvCache, env } from "./env";

describe("env.validate", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    clearEnvCache();
    delete process.env.NODE_ENV;
    delete process.env.DATABASE_URL;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.RESEND_API_KEY;
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
    clearEnvCache();
    vi.restoreAllMocks();
  });

  it("warns for missing required environment variables in production", () => {
    process.env.NODE_ENV = "production";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    env.validate();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing required environment variable in production: DATABASE_URL"),
    );
  });
});
