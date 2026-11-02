// @vitest-environment node
/**
 * Unit tests for the Sberbank acquiring stub provider. Until real credentials
 * are issued, the provider must fail loudly on every money-moving operation
 * and reject all webhooks (Sber does not cryptographically sign them).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    sberUsername: undefined,
    sberPassword: undefined,
  } as Record<string, string | undefined>,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { SberbankProvider } from "@/lib/payments/providers/sberbank";
import type { CreatePaymentInput, WebhookContext } from "@/lib/payments/types";

const fetchMock = vi.fn();

function resetEnv() {
  mockEnv.sberUsername = "login-api";
  mockEnv.sberPassword = "password-api";
}

function baseInput(overrides: Partial<CreatePaymentInput> = {}): CreatePaymentInput {
  return {
    paymentId: "internal-pay-1",
    idempotenceKey: "idem-1",
    amount: 1990,
    currency: "RUB",
    description: "Курс \"TypeScript\"",
    returnUrl: "https://maestria.edu/payment/internal-pay-1",
    method: "SBERPAY",
    customer: { email: "student@example.com" },
    ...overrides,
  };
}

function webhookCtx(): WebhookContext {
  return {
    rawBody: '{"mdOrder":"sber-1","orderNumber":"internal-1","status":"DEPOSITED","operation":"deposited"}',
    headers: {},
    clientIp: "203.0.113.7",
    provider: "SBER",
  };
}

let provider: SberbankProvider;

beforeEach(() => {
  resetEnv();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  provider = new SberbankProvider();
});

describe("configuration", () => {
  it("isConfigured requires both username and password", () => {
    expect(provider.isConfigured()).toBe(true);
    mockEnv.sberUsername = undefined;
    expect(provider.isConfigured()).toBe(false);
    mockEnv.sberUsername = "login-api";
    mockEnv.sberPassword = undefined;
    expect(provider.isConfigured()).toBe(false);
  });

  it("declares identity and supported methods", () => {
    expect(provider.name).toBe("SBER");
    expect(provider.supportedMethods).toEqual(["CARD", "SBP", "SBERPAY"]);
  });
});

describe("not-implemented operations fail loudly without network calls", () => {
  it("createPayment mentions the order and amount", async () => {
    await expect(provider.createPayment(baseInput({ amount: 4990.5 }))).rejects.toThrow(
      /Sberbank createPayment: not implemented.*Order internal-pay-1 for 4990\.5 RUB/s,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancelPayment includes the provider payment id", async () => {
    await expect(provider.cancelPayment("sber-1", "idem")).rejects.toThrow(
      /Sberbank cancelPayment: not implemented \(sber-1\)/,
    );
  });

  it("refundPayment includes the provider payment id", async () => {
    await expect(
      provider.refundPayment({
        providerPaymentId: "sber-1",
        amount: 100,
        idempotenceKey: "idem",
      }),
    ).rejects.toThrow(/Sberbank refundPayment: not implemented \(sber-1\)/);
  });

  it("getPaymentStatus includes the provider payment id", async () => {
    await expect(provider.getPaymentStatus("sber-1")).rejects.toThrow(
      /Sberbank getPaymentStatus: not implemented \(sber-1\)/,
    );
  });
});

describe("verifyWebhook", () => {
  it("rejects every webhook while verification is not implemented", () => {
    expect(provider.verifyWebhook(webhookCtx(), {})).toBe(false);
    expect(provider.verifyWebhook(webhookCtx(), {})).toBe(false);
  });
});

describe("parseWebhook", () => {
  it("builds eventId from mdOrder + operation and maps a deposited payment", () => {
    const parsed = provider.parseWebhook(
      { mdOrder: "sber-1", orderNumber: "internal-1", status: "DEPOSITED", operation: "deposited" },
      webhookCtx(),
    );
    expect(parsed.eventId).toBe("sber:sber-1:deposited");
    expect(parsed.event).toBe("deposited");
    expect(parsed.providerPaymentId).toBe("sber-1");
    expect(parsed.internalPaymentId).toBe("internal-1");
    expect(parsed.status).toBe("completed");
  });

  it("falls back to payment.unknown when the operation is missing", () => {
    const parsed = provider.parseWebhook({ mdOrder: "sber-2", status: "DECLINED" }, webhookCtx());
    expect(parsed.event).toBe("payment.unknown");
    expect(parsed.eventId).toBe("sber:sber-2:");
    expect(parsed.status).toBe("failed");
  });

  it("maps Sberbank order bundle statuses", () => {
    const cases: Array<[string | undefined, string]> = [
      ["PREAUTHORIZED", "pending"],
      ["CREATED", "pending"],
      ["DEPOSITED", "completed"],
      ["DECLINED", "failed"],
      ["REVERSED", "failed"],
      ["REFUNDED", "refunded"],
      ["PARTIAL_REFUNDED", "refunded"],
      ["HOLD", "pending"], // unknown → pending (fail-safe)
      [undefined, "pending"],
    ];
    for (const [raw, expected] of cases) {
      const parsed = provider.parseWebhook({ status: raw, mdOrder: "sber-x" }, webhookCtx());
      expect(parsed.status).toBe(expected);
    }
  });
});
