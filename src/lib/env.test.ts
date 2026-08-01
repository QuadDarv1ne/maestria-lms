import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearEnvCache, env } from "./env";

describe("env.validate", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all test-related env vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("NEXT_PUBLIC_") || key === "DATABASE_URL" || key === "NEXTAUTH_SECRET" || key === "RESEND_API_KEY" || key === "REDIS_URL" || key === "NODE_ENV") {
        delete (process.env as Record<string, string | undefined>)[key];
      }
    }
    // Restore non-test env vars
    Object.assign(process.env, originalEnv);
    clearEnvCache();
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    clearEnvCache();
    vi.restoreAllMocks();
  });

  it("warns for missing required environment variables in production", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    env.validate();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing required environment variable in production: DATABASE_URL"),
    );
  });
});
