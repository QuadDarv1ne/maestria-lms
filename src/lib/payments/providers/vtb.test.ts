// @vitest-environment node
/**
 * Unit tests for the VTB Acquiring stub provider. Until real credentials are
 * issued, the provider must fail loudly on every money-moving operation and —
 * critically — reject all webhooks instead of trusting unsigned notifications.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    vtbMerchantId: undefined,
    vtbSecretKey: undefined,
  } as Record<string, string | undefined>,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { VtbProvider } from "@/lib/payments/providers/vtb";
import type { CreatePaymentInput, WebhookContext } from "@/lib/payments/types";

const fetchMock = vi.fn();

function resetEnv() {
  mockEnv.vtbMerchantId = "merchant-1";
  mockEnv.vtbSecretKey = "secret-1";
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
    rawBody: '{"transaction_id":"vtb-1","order_id":"internal-1","status":"success"}',
    headers: {},
    clientIp: "203.0.113.7",
    provider: "VTB",
  };
}

let provider: VtbProvider;

beforeEach(() => {
  resetEnv();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  provider = new VtbProvider();
});

describe("configuration", () => {
  it("isConfigured requires both merchantId and secretKey", () => {
    expect(provider.isConfigured()).toBe(true);
    mockEnv.vtbMerchantId = undefined;
    expect(provider.isConfigured()).toBe(false);
    mockEnv.vtbMerchantId = "merchant-1";
    mockEnv.vtbSecretKey = undefined;
    expect(provider.isConfigured()).toBe(false);
  });

  it("declares identity and supported methods", () => {
    expect(provider.name).toBe("VTB");
    expect(provider.supportedMethods).toEqual(["CARD", "SBP"]);
  });
});

describe("not-implemented operations fail loudly without network calls", () => {
  it("createPayment mentions the order and amount", async () => {
    await expect(provider.createPayment(baseInput({ amount: 4990.5 }))).rejects.toThrow(
      /VTB createPayment: not implemented.*Order internal-pay-1 for 4990\.5 RUB/s,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancelPayment includes the provider payment id", async () => {
    await expect(provider.cancelPayment("vtb-1", "idem")).rejects.toThrow(
      /VTB cancelPayment: not implemented \(vtb-1\)/,
    );
  });

  it("refundPayment includes the provider payment id", async () => {
    await expect(
      provider.refundPayment({
        providerPaymentId: "vtb-1",
        amount: 100,
        idempotenceKey: "idem",
      }),
    ).rejects.toThrow(/VTB refundPayment: not implemented \(vtb-1\)/);
  });

  it("getPaymentStatus includes the provider payment id", async () => {
    await expect(provider.getPaymentStatus("vtb-1")).rejects.toThrow(
      /VTB getPaymentStatus: not implemented \(vtb-1\)/,
    );
  });
});

describe("verifyWebhook", () => {
  it("rejects every webhook while verification is not implemented", () => {
    // Принимать неподписанные уведомления "как есть" означало бы позволить
    // кому угодно подтвердить оплату без денег — потому жёсткий отказ.
    expect(provider.verifyWebhook(webhookCtx(), {})).toBe(false);
    expect(provider.verifyWebhook(webhookCtx(), {})).toBe(false);
  });
});

describe("parseWebhook", () => {
  it("builds eventId from event_id with transaction_id fallback and maps status", () => {
    const parsed = provider.parseWebhook(
      { event_id: "evt-1", transaction_id: "vtb-1", order_id: "internal-1", status: "success" },
      webhookCtx(),
    );
    expect(parsed.eventId).toBe("vtb:evt-1");
    expect(parsed.event).toBe("payment.notification");
    expect(parsed.providerPaymentId).toBe("vtb-1");
    expect(parsed.internalPaymentId).toBe("internal-1");
    expect(parsed.status).toBe("completed");
  });

  it("falls back to transaction_id and empty id for eventId", () => {
    const parsed = provider.parseWebhook(
      { transaction_id: "vtb-2", status: "declined" },
      webhookCtx(),
    );
    expect(parsed.eventId).toBe("vtb:vtb-2");
    expect(parsed.status).toBe("failed");

    const empty = provider.parseWebhook({}, webhookCtx());
    expect(empty.eventId).toBe("vtb:");
    expect(empty.internalPaymentId).toBeUndefined();
    expect(empty.status).toBe("pending");
  });

  it("maps VTB statuses case-insensitively", () => {
    const cases: Array<[string | undefined, string]> = [
      ["NEW", "pending"],
      ["pending", "pending"],
      ["Authorized", "pending"],
      ["success", "completed"],
      ["Completed", "completed"],
      ["deposited", "completed"],
      ["declined", "failed"],
      ["Cancelled", "failed"],
      ["refunded", "refunded"],
      ["partial_refunded", "refunded"],
      ["weird-status", "pending"],
      [undefined, "pending"],
    ];
    for (const [raw, expected] of cases) {
      const parsed = provider.parseWebhook(
        { status: raw, transaction_id: "vtb-x" },
        webhookCtx(),
      );
      expect(parsed.status).toBe(expected);
    }
  });
});
