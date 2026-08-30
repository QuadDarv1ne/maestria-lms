/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { FEATURE_FLAGS, type FeatureFlagKey } from "@/lib/feature-flags-config";

describe("FEATURE_FLAGS config", () => {
  const flags = Object.values(FEATURE_FLAGS);
  const keys = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];

  it("should define at least one flag", () => {
    expect(flags.length).toBeGreaterThan(0);
  });

  it("should have keys that match the key property of each definition", () => {
    for (const key of keys) {
      expect(FEATURE_FLAGS[key].key).toBe(key);
    }
  });

  it("should have unique keys", () => {
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("should have non-empty descriptions", () => {
    for (const flag of flags) {
      expect(flag.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("should have rollouts in [0,100] or null", () => {
    for (const flag of flags) {
      if (flag.rolloutPercentage !== null && flag.rolloutPercentage !== undefined) {
        expect(flag.rolloutPercentage).toBeGreaterThanOrEqual(0);
        expect(flag.rolloutPercentage).toBeLessThanOrEqual(100);
      }
    }
  });

  it("should have a valid environment restriction, if any", () => {
    for (const flag of flags) {
      if (flag.environment !== null && flag.environment !== undefined) {
        expect(["development", "production"]).toContain(flag.environment);
      }
    }
  });
});
