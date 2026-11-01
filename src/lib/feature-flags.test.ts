/**
 * Тесты feature-flags в клиентском (jsdom) окружении.
 *
 * Модуль хранит состояние во внутренних Map-кэшах (flagCache,
 * serverFlagOverrides), которые не экспортируются — поэтому каждый тест
 * получает свежий экземпляр модуля через vi.resetModules + dynamic import.
 *
 * FEATURE_FLAGS расширяется тестовыми флагами с rollout 0% и 50%,
 * чтобы покрыть ветку процентного раскатывания (в проде все флаги 100/null).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Node 22+ определяет собственный глобальный localStorage (undefined без
// --localstorage-file), а window === globalThis в vitest jsdom, поэтому
// jsdom-реализация недоступна. Подменяем глобал на in-memory Storage,
// чтобы голый localStorage внутри модуля и тестов работал.
function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  const keys = () => Array.from(map.keys());
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    key: (index: number) => keys()[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
  };
}

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: createMemoryStorage(),
});

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

describe("feature-flags (client)", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    for (const key of ENV_KEYS) delete process.env[key];
    logWarn.mockClear();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    window.history.replaceState(null, "", "/");
  });

  it("returns defaultValue when no overrides are set", async () => {
    const flags = await loadModule();
    expect(flags.isFeatureEnabled("socialLogin")).toBe(false);
    expect(flags.isFeatureEnabled("emailVerification")).toBe(true);
  });

  it("URL param flag-<key>=true overrides default", async () => {
    window.history.replaceState(null, "", "/?flag-socialLogin=true");
    const flags = await loadModule();
    expect(flags.isFeatureEnabled("socialLogin")).toBe(true);
  });

  it("URL param flag-<key>=false overrides default true", async () => {
    window.history.replaceState(null, "", "/?flag-emailVerification=false");
    const flags = await loadModule();
    expect(flags.isFeatureEnabled("emailVerification")).toBe(false);
  });

  it("ignores garbage URL param values", async () => {
    window.history.replaceState(null, "", "/?flag-socialLogin=yes");
    const flags = await loadModule();
    expect(flags.isFeatureEnabled("socialLogin")).toBe(false);
  });

  it("env var overrides URL param (priority 1 > 2)", async () => {
    window.history.replaceState(null, "", "/?flag-socialLogin=true");
    process.env.FEATURE_FLAG_SOCIALLOGIN = "false";
    const flags = await loadModule();
    expect(flags.isFeatureEnabled("socialLogin")).toBe(false);
  });

  it("env var true/false overrides default", async () => {
    process.env.FEATURE_FLAG_SOCIALLOGIN = "true";
    const flags1 = await loadModule();
    expect(flags1.isFeatureEnabled("socialLogin")).toBe(true);

    process.env.FEATURE_FLAG_SOCIALLOGIN = "false";
    const flags2 = await loadModule();
    expect(flags2.isFeatureEnabled("socialLogin")).toBe(false);
  });

  it("localStorage overrides default", async () => {
    localStorage.setItem("feature-flag:socialLogin", "true");
    const flags = await loadModule();
    expect(flags.isFeatureEnabled("socialLogin")).toBe(true);
  });

  it("URL param beats localStorage (priority 2 > 3)", async () => {
    localStorage.setItem("feature-flag:socialLogin", "true");
    window.history.replaceState(null, "", "/?flag-socialLogin=false");
    const flags = await loadModule();
    expect(flags.isFeatureEnabled("socialLogin")).toBe(false);
  });

  it("caches first evaluation and clearFeatureFlags resets it", async () => {
    localStorage.setItem("feature-flag:socialLogin", "true");
    const flags = await loadModule();

    expect(flags.isFeatureEnabled("socialLogin")).toBe(true);

    // clearFeatureFlags удаляет только ключи feature-flag:* из localStorage
    flags.clearFeatureFlags();
    expect(localStorage.getItem("feature-flag:socialLogin")).toBeNull();
    expect(flags.isFeatureEnabled("socialLogin")).toBe(false);
  });

  it("setFeatureFlag writes localStorage and cache", async () => {
    const flags = await loadModule();
    flags.setFeatureFlag("darkModeAmber", false);

    expect(localStorage.getItem("feature-flag:darkModeAmber")).toBe("false");
    expect(flags.isFeatureEnabled("darkModeAmber")).toBe(false);

    flags.clearFeatureFlags();
    expect(localStorage.getItem("feature-flag:darkModeAmber")).toBeNull();
    expect(flags.isFeatureEnabled("darkModeAmber")).toBe(true);
  });

  it("server override is ignored on the client", async () => {
    const flags = await loadModule();
    flags.setServerFeatureFlag("emailVerification", false);
    // Клиентский путь не использует serverFlagOverrides
    expect(flags.isFeatureEnabled("emailVerification")).toBe(true);
  });

  it("warns and returns false for unknown flag key", async () => {
    const flags = await loadModule();
    const unknown = "nonexistent" as import("@/lib/feature-flags-config").FeatureFlagKey;
    expect(flags.isFeatureEnabled(unknown)).toBe(false);
    expect(logWarn).toHaveBeenCalledTimes(1);
    expect(String(logWarn.mock.calls[0][0])).toContain("nonexistent");
  });

  it("getAllFeatureFlags returns boolean evaluation for every flag", async () => {
    const flags = await loadModule();
    const all = flags.getAllFeatureFlags();

    // 13 продовых + 2 тестовых флага
    expect(Object.keys(all).length).toBe(15);
    for (const value of Object.values(all)) {
      expect(typeof value).toBe("boolean");
    }
    expect(all.socialLogin).toBe(false);
    expect(all.emailVerification).toBe(true);
  });

  it("rollout 0% never enables the flag even with default true", async () => {
    const flags = await loadModule();
    expect(flags.isFeatureEnabled("testRolloutZero")).toBe(false);
  });

  it("rollout 100% skips hashing and returns defaultValue", async () => {
    const flags = await loadModule();
    expect(flags.isFeatureEnabled("paymentWebhooks")).toBe(true);
  });

  it("rollout 50% is deterministic for the same seed", async () => {
    const first = await loadModule();
    const result1 = first.isFeatureEnabled("testRolloutFifty");

    const second = await loadModule();
    const result2 = second.isFeatureEnabled("testRolloutFifty");

    expect(typeof result1).toBe("boolean");
    expect(result1).toBe(result2);
  });
});
