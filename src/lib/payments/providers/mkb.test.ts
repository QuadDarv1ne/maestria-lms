// @vitest-environment node
/**
 * Unit tests for the MKB (Moscow Credit Bank) stub provider. Until real
 * credentials are issued, the provider must fail loudly on every money-moving
 * operation and reject all webhooks instead of trusting notifications.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    mkbMerchantId: undefined,
    mkbSecretKey: undefined,
  } as Record<string, string | undefined>,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { MkbProvider } from "@/lib/payments/providers/mkb";
import type { CreatePaymentInput, WebhookContext } from "@/lib/payments/types";

const fetchMock = vi.fn();

function resetEnv() {
  mockEnv.mkbMerchantId = "merchant-1";
  mockEnv.mkbSecretKey = "secret-1";
}

function baseInput(overrides: Partial<CreatePaymentInput> = {}): CreatePaymentInput {
  return {
    paymentId: "internal-pay-1",
    idempotenceKey: "idem-1",
    amount: 1990,
    currency: "RUB",
    description: "Курс \"TypeScript\"",
    returnUrl: "https://maestria.edu/payment/internal-pay-1",
    method: "CARD",
    customer: { email: "student@example.com" },
    ...overrides,
  };
}

function webhookCtx(): WebhookContext {
  return {
    rawBody: '{"payment_id":"mkb-1","order_id":"internal-1","status":"success"}',
    headers: {},
    clientIp: "203.0.113.7",
    provider: "MKB",
  };
}

let provider: MkbProvider;

beforeEach(() => {
  resetEnv();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  provider = new MkbProvider();
});

describe("configuration", () => {
  it("isConfigured requires both merchantId and secretKey", () => {
    expect(provider.isConfigured()).toBe(true);
    mockEnv.mkbMerchantId = undefined;
    expect(provider.isConfigured()).toBe(false);
    mockEnv.mkbMerchantId = "merchant-1";
    mockEnv.mkbSecretKey = undefined;
    expect(provider.isConfigured()).toBe(false);
  });

  it("declares identity and supported methods", () => {
    expect(provider.name).toBe("MKB");
    expect(provider.supportedMethods).toEqual(["CARD", "SBP"]);
  });
});

describe("not-implemented operations fail loudly without network calls", () => {
  it("createPayment rejects before any network call", async () => {
    await expect(provider.createPayment(baseInput())).rejects.toThrow(
      /MKB createPayment: not implemented/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancelPayment includes the provider payment id", async () => {
    await expect(provider.cancelPayment("mkb-1", "idem")).rejects.toThrow(
      /MKB cancelPayment: not implemented \(mkb-1\)/,
    );
  });

  it("refundPayment includes the provider payment id", async () => {
    await expect(
      provider.refundPayment({
        providerPaymentId: "mkb-1",
        amount: 100,
        idempotenceKey: "idem",
      }),
    ).rejects.toThrow(/MKB refundPayment: not implemented \(mkb-1\)/);
  });

  it("getPaymentStatus includes the provider payment id", async () => {
    await expect(provider.getPaymentStatus("mkb-1")).rejects.toThrow(
      /MKB getPaymentStatus: not implemented \(mkb-1\)/,
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
  it("builds eventId from event_id with payment_id fallback and maps status", () => {
    const parsed = provider.parseWebhook(
      { event_id: "evt-1", payment_id: "mkb-1", order_id: "internal-1", status: "captured" },
      webhookCtx(),
    );
    expect(parsed.eventId).toBe("mkb:evt-1");
    expect(parsed.event).toBe("payment.notification");
    expect(parsed.providerPaymentId).toBe("mkb-1");
    expect(parsed.internalPaymentId).toBe("internal-1");
    expect(parsed.status).toBe("completed");
  });

  it("falls back to payment_id and empty id for eventId", () => {
    const parsed = provider.parseWebhook(
      { payment_id: "mkb-2", status: "declined" },
      webhookCtx(),
    );
    expect(parsed.eventId).toBe("mkb:mkb-2");
    expect(parsed.status).toBe("failed");

    const empty = provider.parseWebhook({}, webhookCtx());
    expect(empty.eventId).toBe("mkb:");
    expect(empty.internalPaymentId).toBeUndefined();
    expect(empty.status).toBe("pending");
  });

  it("maps MKB statuses case-insensitively", () => {
    const cases: Array<[string | undefined, string]> = [
      ["PENDING", "pending"],
      ["authorized", "pending"],
      ["success", "completed"],
      ["CAPTURED", "completed"],
      ["DECLINED", "failed"],
      ["refunded", "refunded"],
      ["weird-status", "pending"],
      [undefined, "pending"],
    ];
    for (const [raw, expected] of cases) {
      const parsed = provider.parseWebhook({ status: raw, payment_id: "mkb-x" }, webhookCtx());
      expect(parsed.status).toBe(expected);
    }
  });
});
