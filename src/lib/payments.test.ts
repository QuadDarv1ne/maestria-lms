// @vitest-environment node
/**
 * Unit tests for the multi-gateway payment layer:
 * provider resolution, method routing, webhook detection, receipts and the
 * security posture of not-yet-implemented providers.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    yooKassaShopId: undefined,
    yooKassaSecretKey: undefined,
    tinkoffTerminalKey: undefined,
    tinkoffPassword: undefined,
    cloudPaymentsPublicId: undefined,
    cloudPaymentsApiSecret: undefined,
    sberUsername: undefined,
    sberPassword: undefined,
    ozonClientId: undefined,
    ozonApiKey: undefined,
    ozonWebhookSecret: undefined,
    vtbMerchantId: undefined,
    vtbSecretKey: undefined,
    mkbMerchantId: undefined,
    mkbSecretKey: undefined,
    siteUrl: "http://localhost:3000",
    paymentWebhookSecret: undefined,
  } as Record<string, string | undefined>,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  db: {},
  Prisma: {},
}));

vi.mock("@/lib/promo-code", () => ({
  validatePromoCode: vi.fn(),
  redeemPromoCode: vi.fn(),
}));

import {
  getAvailablePaymentOptions,
  getProvider,
  parseProviderName,
  detectProviderFromWebhook,
  methodLabel,
} from "@/lib/payments/registry";
import { resolveProviderAndMethod, parsePaymentMethod } from "@/lib/payments/service";
import { buildCourseReceipt } from "@/lib/payments/receipts";
import { isIpAllowed } from "@/lib/payments/ip-whitelist";
import type { WebhookContext } from "@/lib/payments/types";

function resetEnv() {
  for (const key of Object.keys(mockEnv)) {
    if (key !== "siteUrl") mockEnv[key] = undefined;
  }
}

function webhookCtx(overrides: Partial<WebhookContext> = {}): WebhookContext {
  return {
    rawBody: "{}",
    headers: {},
    clientIp: undefined,
    provider: "YOOKASSA",
    ...overrides,
  };
}

beforeEach(resetEnv);
afterEach(resetEnv);

describe("parseProviderName", () => {
  it("accepts known provider names case-insensitively", () => {
    expect(parseProviderName("yookassa")).toBe("YOOKASSA");
    expect(parseProviderName("Tinkoff")).toBe("TINKOFF");
    expect(parseProviderName("ozon")).toBe("OZON");
  });

  it("returns null for unknown or empty values", () => {
    expect(parseProviderName("stripe")).toBeNull();
    expect(parseProviderName("")).toBeNull();
    expect(parseProviderName(null)).toBeNull();
    expect(parseProviderName(undefined)).toBeNull();
  });
});

describe("parsePaymentMethod", () => {
  it("normalises method casing", () => {
    expect(parsePaymentMethod("card")).toBe("CARD");
    expect(parsePaymentMethod("Sbp")).toBe("SBP");
    expect(parsePaymentMethod("yandex_pay")).toBe("YANDEX_PAY");
  });

  it("rejects unknown methods", () => {
    expect(parsePaymentMethod("bitcoin")).toBeNull();
    expect(parsePaymentMethod("")).toBeNull();
  });
});

describe("resolveProviderAndMethod", () => {
  it("keeps an explicit provider + method pair", () => {
    expect(
      resolveProviderAndMethod({ provider: "TINKOFF", method: "SBP" }),
    ).toEqual({ provider: "TINKOFF", method: "SBP" });
  });

  it("maps legacy paymentMethod values", () => {
    expect(resolveProviderAndMethod({ legacyPaymentMethod: "sbp" })).toEqual({
      provider: "YOOKASSA",
      method: "SBP",
    });
    expect(resolveProviderAndMethod({ legacyPaymentMethod: "tinkoff" })).toEqual({
      provider: "TINKOFF",
      method: "CARD",
    });
    expect(resolveProviderAndMethod({ legacyPaymentMethod: "card" })).toEqual({
      provider: "YOOKASSA",
      method: "CARD",
    });
  });

  it("lets an explicit provider override the legacy mapping", () => {
    expect(
      resolveProviderAndMethod({ legacyPaymentMethod: "card", provider: "CLOUDPAYMENTS" }),
    ).toEqual({ provider: "CLOUDPAYMENTS", method: "CARD" });
  });

  it("returns an error when no method is given", () => {
    const result = resolveProviderAndMethod({});
    expect("error" in result).toBe(true);
  });

  it("returns an error for an unknown method", () => {
    const result = resolveProviderAndMethod({ method: "bitcoin" });
    expect("error" in result).toBe(true);
  });
});

describe("getAvailablePaymentOptions", () => {
  it("exposes a test-mode option when nothing is configured", () => {
    const options = getAvailablePaymentOptions();
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ provider: "YOOKASSA", method: "CARD", testMode: true });
  });

  it("de-duplicates methods across configured providers", () => {
    mockEnv.yooKassaShopId = "123";
    mockEnv.yooKassaSecretKey = "secret";
    mockEnv.tinkoffTerminalKey = "terminal";
    mockEnv.tinkoffPassword = "password";

    const options = getAvailablePaymentOptions();
    const cards = options.filter((o) => o.method === "CARD");
    expect(cards).toHaveLength(1);
    expect(cards[0].provider).toBe("YOOKASSA");
    // T-Pay поддерживают оба провайдера — в списке он должен быть один раз.
    expect(options.filter((o) => o.method === "TPAY")).toHaveLength(1);
  });

  it("only lists methods of configured providers", () => {
    mockEnv.tinkoffTerminalKey = "terminal";
    mockEnv.tinkoffPassword = "password";

    const options = getAvailablePaymentOptions();
    expect(options.every((o) => o.provider === "TINKOFF")).toBe(true);
    expect(options.some((o) => o.method === "YOOMONEY")).toBe(false);
  });
});

describe("methodLabel", () => {
  it("returns a Russian label for every known method", () => {
    expect(methodLabel("SBP")).toContain("СБП");
    expect(methodLabel("CARD")).toBe("Банковская карта");
  });
});

describe("detectProviderFromWebhook", () => {
  it("recognises providers by signature headers", () => {
    expect(detectProviderFromWebhook({ "x-content-hmac": "abc" }, {})).toBe("CLOUDPAYMENTS");
    expect(detectProviderFromWebhook({ "x-ozon-signature": "abc" }, {})).toBe("OZON");
  });

  it("recognises T-Bank by TerminalKey + Token", () => {
    expect(
      detectProviderFromWebhook({}, { TerminalKey: "t", Token: "x", Status: "CONFIRMED" }),
    ).toBe("TINKOFF");
  });

  it("recognises CloudPayments by InvoiceId", () => {
    expect(detectProviderFromWebhook({}, { InvoiceId: "p1", Status: "Completed" })).toBe(
      "CLOUDPAYMENTS",
    );
  });

  it("recognises Sberbank by mdOrder", () => {
    expect(detectProviderFromWebhook({}, { mdOrder: "order-1", status: "DEPOSITED" })).toBe(
      "SBER",
    );
  });

  it("recognises the ЮKassa payload shape", () => {
    expect(
      detectProviderFromWebhook({}, { event: "payment.succeeded", object: { id: "1" } }),
    ).toBe("YOOKASSA");
  });

  it("returns null for an unrecognisable body", () => {
    expect(detectProviderFromWebhook({}, { foo: "bar" })).toBeNull();
    expect(detectProviderFromWebhook({}, null)).toBeNull();
    expect(detectProviderFromWebhook({}, "string")).toBeNull();
  });
});

describe("buildCourseReceipt", () => {
  it("builds a single-item service receipt without VAT by default", () => {
    const receipt = buildCourseReceipt({
      courseTitle: "TypeScript с нуля",
      amount: 4990.5,
      customer: { email: "student@example.com" },
    });

    expect(receipt.customer.email).toBe("student@example.com");
    expect(receipt.items).toHaveLength(1);
    expect(receipt.items[0]).toMatchObject({
      description: "TypeScript с нуля",
      amount: 4990.5,
      quantity: 1,
      vatCode: 4,
      paymentMode: "full_payment",
      paymentSubject: "service",
    });
  });

  it("honours an explicit VAT code", () => {
    const receipt = buildCourseReceipt({
      courseTitle: "Курс",
      amount: 1200,
      customer: { phone: "+79990000000" },
      vatCode: 1,
    });
    expect(receipt.items[0].vatCode).toBe(1);
    expect(receipt.customer.phone).toBe("+79990000000");
  });
});

describe("isIpAllowed", () => {
  it("allows any IP for providers without a published range", () => {
    expect(isIpAllowed("SBER", "203.0.113.5")).toBe(true);
    expect(isIpAllowed("UNKNOWN", "203.0.113.5")).toBe(true);
  });

  it("accepts an IP inside the ЮKassa range", () => {
    expect(isIpAllowed("YOOKASSA", "185.71.76.10")).toBe(true);
  });

  it("rejects an IP outside the ЮKassa range", () => {
    expect(isIpAllowed("YOOKASSA", "203.0.113.5")).toBe(false);
  });

  it("rejects a missing or malformed IP for providers with a range", () => {
    expect(isIpAllowed("YOOKASSA", undefined)).toBe(false);
    expect(isIpAllowed("YOOKASSA", "not-an-ip")).toBe(false);
  });
});

describe("provider webhook security", () => {
  it("rejects ЮKassa webhooks without signature or client IP", () => {
    const provider = getProvider("YOOKASSA");
    expect(provider.verifyWebhook(webhookCtx(), {})).toBe(false);
  });

  it("accepts ЮKassa webhooks from a whitelisted IP", () => {
    const provider = getProvider("YOOKASSA");
    expect(provider.verifyWebhook(webhookCtx({ clientIp: "185.71.76.10" }), {})).toBe(true);
  });

  it("never accepts webhooks for providers that are still stubs", () => {
    for (const name of ["SBER", "VTB", "MKB"] as const) {
      const provider = getProvider(name);
      expect(provider.verifyWebhook(webhookCtx({ provider: name, clientIp: "185.71.76.10" }), {})).toBe(
        false,
      );
    }
  });

  it("rejects T-Bank webhooks without a valid Token", () => {
    mockEnv.tinkoffTerminalKey = "terminal";
    mockEnv.tinkoffPassword = "password";
    const provider = getProvider("TINKOFF");
    expect(provider.verifyWebhook(webhookCtx({ provider: "TINKOFF" }), { Status: "CONFIRMED" })).toBe(
      false,
    );
  });
});

describe("ЮKassa webhook parsing", () => {
  it("parses a payment.succeeded event", () => {
    const provider = getProvider("YOOKASSA");
    const parsed = provider.parseWebhook(
      {
        event: "payment.succeeded",
        object: {
          id: "provider-1",
          status: "succeeded",
          amount: { value: "5000.00" },
          metadata: { paymentId: "internal-1" },
        },
      },
      webhookCtx(),
    );

    expect(parsed).toMatchObject({
      eventId: "payment.succeeded:provider-1",
      event: "payment.succeeded",
      providerPaymentId: "provider-1",
      internalPaymentId: "internal-1",
      status: "completed",
      amount: 5000,
    });
  });

  it("maps canceled to failed", () => {
    const provider = getProvider("YOOKASSA");
    const parsed = provider.parseWebhook(
      { event: "payment.canceled", object: { id: "provider-2", status: "canceled" } },
      webhookCtx(),
    );
    expect(parsed.status).toBe("failed");
  });

  it("supports legacy payloads that only carry a status", () => {
    const provider = getProvider("YOOKASSA");
    const parsed = provider.parseWebhook(
      {
        eventId: "evt-legacy-1",
        status: "succeeded",
        object: { id: "provider-3", transactionId: "txn-3", metadata: { paymentId: "internal-3" } },
      },
      webhookCtx(),
    );

    expect(parsed.eventId).toBe("evt-legacy-1");
    expect(parsed.event).toBe("payment.succeeded");
    expect(parsed.providerPaymentId).toBe("provider-3");
    expect(parsed.internalPaymentId).toBe("internal-3");
    expect(parsed.status).toBe("completed");
  });

  it("parses refund events against the original payment id", () => {
    const provider = getProvider("YOOKASSA");
    const parsed = provider.parseWebhook(
      {
        event: "refund.succeeded",
        object: { id: "refund-1", status: "succeeded", payment_id: "provider-1" },
      },
      webhookCtx(),
    );

    expect(parsed.event).toBe("refund.succeeded");
    expect(parsed.providerPaymentId).toBe("provider-1");
    expect(parsed.status).toBe("refunded");
  });
});
