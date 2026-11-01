/**
 * @vitest-environment node
 *
 * Серверные тесты feature-flags: без window/localStorage, с priority
 * server override > env > rollout > default. Модуль хранит
 * serverFlagOverrides во внутреннем Map — каждый тест получает свежий
 * экземпляр через vi.resetModules + dynamic import.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { logWarn } = vi.hoisted(() => ({ logWarn: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  log: { warn: logWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/feature-flags-config", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/feature-flags-config")
  >();
  return {
    ...actual,
    FEATURE_FLAGS: {
      ...actual.FEATURE_FLAGS,
      testRolloutZero: {
        key: "testRolloutZero",
        description: "Rollout 0% — никогда не включён",
        defaultValue: true,
        rolloutPercentage: 0,
      },
      testRolloutFifty: {
        key: "testRolloutFifty",
        description: "Rollout 50% — детерминирован по seed",
        defaultValue: false,
        rolloutPercentage: 50,
      },
    },
  };
});

type FlagsModule = typeof import("@/lib/feature-flags");

async function loadModule(): Promise<FlagsModule> {
  vi.resetModules();
  return await import("@/lib/feature-flags");
}

const ENV_KEYS = ["FEATURE_FLAG_SOCIALLOGIN", "FEATURE_FLAG_EMAILVERIFICATION"];

describe("feature-flags (server)", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    logWarn.mockClear();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("returns defaultValue when no overrides are set", async () => {
    const flags = await loadModule();
    expect(flags.isFeatureEnabled("socialLogin")).toBe(false);
    expect(flags.isFeatureEnabled("emailVerification")).toBe(true);
  });

  it("env var true/false overrides default", async () => {
    process.env.FEATURE_FLAG_SOCIALLOGIN = "true";
    const flags1 = await loadModule();
    expect(flags1.isFeatureEnabled("socialLogin")).toBe(true);

    process.env.FEATURE_FLAG_SOCIALLOGIN = "false";
    const flags2 = await loadModule();
    expect(flags2.isFeatureEnabled("socialLogin")).toBe(false);
  });

  it("env var with non-boolean value is ignored", async () => {
    process.env.FEATURE_FLAG_SOCIALLOGIN = "yes";
    const flags = await loadModule();
    expect(flags.isFeatureEnabled("socialLogin")).toBe(false);
  });

  it("server override beats env var and persists between calls", async () => {
    process.env.FEATURE_FLAG_EMAILVERIFICATION = "true";
    const flags = await loadModule();

    flags.setServerFeatureFlag("emailVerification", false);
    expect(flags.isFeatureEnabled("emailVerification")).toBe(false);
    // Повторный вызов — override всё ещё активен
    expect(flags.isFeatureEnabled("emailVerification")).toBe(false);

    // Убираем env — override продолжает работать
    delete process.env.FEATURE_FLAG_EMAILVERIFICATION;
    expect(flags.isFeatureEnabled("emailVerification")).toBe(false);
  });

  it("getAllFeatureFlags reflects server overrides", async () => {
    const flags = await loadModule();
    flags.setServerFeatureFlag("socialLogin", true);
    const all = flags.getAllFeatureFlags();
    expect(all.socialLogin).toBe(true);
    expect(all.emailVerification).toBe(true);
  });

  it("warns and returns false for unknown flag key", async () => {
    const flags = await loadModule();
    const unknown = "nonexistent" as import("@/lib/feature-flags-config").FeatureFlagKey;
    expect(flags.isFeatureEnabled(unknown)).toBe(false);
    expect(logWarn).toHaveBeenCalledTimes(1);
    expect(String(logWarn.mock.calls[0][0])).toContain("nonexistent");
  });

  it("does not cache server evaluations (env change applies immediately)", async () => {
    process.env.FEATURE_FLAG_SOCIALLOGIN = "true";
    const flags = await loadModule();

    expect(flags.isFeatureEnabled("socialLogin")).toBe(true);
    process.env.FEATURE_FLAG_SOCIALLOGIN = "false";
    // Клиентский кэш на сервере не участвует
    expect(flags.isFeatureEnabled("socialLogin")).toBe(false);

    delete process.env.FEATURE_FLAG_SOCIALLOGIN;
    expect(flags.isFeatureEnabled("socialLogin")).toBe(false);
  });

  it("rollout 0% never enables the flag on the server", async () => {
    const flags = await loadModule();
    expect(flags.isFeatureEnabled("testRolloutZero")).toBe(false);
  });

  it("rollout 50% is deterministic for the server seed", async () => {
    const first = await loadModule();
    const result1 = first.isFeatureEnabled("testRolloutFifty");

    const second = await loadModule();
    const result2 = second.isFeatureEnabled("testRolloutFifty");

    expect(typeof result1).toBe("boolean");
    expect(result1).toBe(result2);
  });
});
