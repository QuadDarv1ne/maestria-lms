import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Feature Flags", () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear any env var overrides
    delete process.env.FEATURE_FLAG_EMAILVERIFICATION;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Feature flag configuration", () => {
    it("should have typed flag definitions", async () => {
      const { FEATURE_FLAGS } = await import("@/lib/feature-flags-config");

      expect(FEATURE_FLAGS.emailVerification).toBeDefined();
      expect(FEATURE_FLAGS.emailVerification.defaultValue).toBe(true);
      expect(FEATURE_FLAGS.socialLogin.defaultValue).toBe(false);
    });

    it("should have rollout percentage for gradual rollout", async () => {
      const { FEATURE_FLAGS } = await import("@/lib/feature-flags-config");

      expect(FEATURE_FLAGS.paymentWebhooks.rolloutPercentage).toBe(100);
    });

    it("should have experimental features disabled by default", async () => {
      const { FEATURE_FLAGS } = await import("@/lib/feature-flags-config");

      expect(FEATURE_FLAGS.socialLogin.defaultValue).toBe(false);
      expect(FEATURE_FLAGS.liveChat.defaultValue).toBe(false);
      expect(FEATURE_FLAGS.aiTutor.defaultValue).toBe(false);
    });
  });

  describe("Feature flag evaluation", () => {
    it("should return default value when no override", async () => {
      const { isFeatureEnabled } = await import("@/lib/feature-flags");

      // Server-side: no localStorage, no URL params
      expect(isFeatureEnabled("emailVerification")).toBe(true);
      expect(isFeatureEnabled("socialLogin")).toBe(false);
    });

    it("should respect environment variable override", async () => {
      process.env.FEATURE_FLAG_SOCIALLOGIN = "true";

      // Need to reimport after env change
      vi.resetModules();
      const { isFeatureEnabled } = await import("@/lib/feature-flags");

      expect(isFeatureEnabled("socialLogin")).toBe(true);

      delete process.env.FEATURE_FLAG_SOCIALLOGIN;
    });

    it("should warn for unknown flags", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { isFeatureEnabled } = await import("@/lib/feature-flags");

      isFeatureEnabled("nonexistentFlag" as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found in configuration")
      );

      consoleSpy.mockRestore();
    });
  });

  describe("getAllFeatureFlags", () => {
    it("should return all flags with evaluated values", async () => {
      const { getAllFeatureFlags } = await import("@/lib/feature-flags");

      const flags = getAllFeatureFlags();

      expect(flags.emailVerification).toBe(true);
      expect(flags.socialLogin).toBe(false);
      expect(Object.keys(flags).length).toBeGreaterThan(10);
    });
  });
});
