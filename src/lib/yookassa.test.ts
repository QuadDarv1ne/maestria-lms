import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/env", () => ({
  env: {
    yooKassaShopId: undefined,
    yooKassaSecretKey: undefined,
    yooKassaApiUrl: undefined,
  },
}));

import { formatYooKassaAmount, isYooKassaConfigured } from "@/lib/yookassa";

describe("yookassa helpers", () => {
  it("formats amounts with two decimal places", () => {
    expect(formatYooKassaAmount(5000)).toBe("5000.00");
    expect(formatYooKassaAmount(5000.5)).toBe("5000.50");
    expect(formatYooKassaAmount(0)).toBe("0.00");
    expect(formatYooKassaAmount(999.999)).toBe("1000.00");
  });

  it("detects missing credentials", () => {
    expect(isYooKassaConfigured()).toBe(false);
  });
});