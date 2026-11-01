// @vitest-environment node
/**
 * Unit tests for the YooKassa provider: request shapes against a stubbed
 * fetch, status mapping, receipt translation, and webhook verification
 * (HMAC signature + published IP whitelist).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    yooKassaShopId: undefined,
    yooKassaSecretKey: undefined,
  } as Record<string, string | undefined>,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { YooKassaProvider } from "@/lib/payments/providers/yookassa";
import type { CreatePaymentInput, WebhookContext } from "@/lib/payments/types";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function resetEnv() {
  mockEnv.yooKassaShopId = "shop-1";
  mockEnv.yooKassaSecretKey = "secret-1";
}

function baseInput(overrides: Partial<CreatePaymentInput> = {}): CreatePaymentInput {
  return {
    paymentId: "internal-pay-1",
    idempotenceKey: "idem-1",
    amount: 4990.5,
    currency: "RUB",
    description: "Курс «TypeScript»",
    returnUrl: "https://maestria.edu/payment/internal-pay-1",
    method: "CARD",
    customer: { email: "student@example.com" },
    metadata: { courseId: "c1" },
    ...overrides,
  };
}

function webhookCtx(overrides: Partial<WebhookContext> = {}): WebhookContext {
  return {
    rawBody: '{"event":"payment.succeeded","object":{"id":"yoo-1","status":"succeeded"}}',
    headers: {},
    clientIp: undefined,
    provider: "YOOKASSA",
    ...overrides,
  };
}

/** First IP inside the published 185.71.76.0/27 YooKassa range. */
const YOOKASSA_IP = "185.71.76.5";
const OUTSIDE_IP = "203.0.113.7";

function expectedHmac(secret: string, body: string, encoding: "hex" | "base64") {
  return crypto.createHmac("sha256", secret).update(body).digest(encoding);
}

let provider: YooKassaProvider;

beforeEach(() => {
  resetEnv();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  provider = new YooKassaProvider();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("configuration", () => {
  it("isConfigured requires both shopId and secretKey", () => {
    expect(provider.isConfigured()).toBe(true);
    mockEnv.yooKassaShopId = undefined;
    expect(provider.isConfigured()).toBe(false);
    mockEnv.yooKassaShopId = "shop-1";
    mockEnv.yooKassaSecretKey = undefined;
    expect(provider.isConfigured()).toBe(false);
  });

  it("declares its supported methods", () => {
    expect(provider.name).toBe("YOOKASSA");
    expect(provider.supportedMethods).toEqual([
      "CARD", "SBP", "YOOMONEY", "SBERPAY", "TPAY", "YANDEX_PAY",
    ]);
  });
});

describe("createPayment", () => {
  it("posts amount with 2 decimals, redirect confirmation and Basic auth", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: "24b9c9b4-000f",
        status: "pending",
        paid: false,
        confirmation: { type: "redirect", confirmation_url: "https://yoomoney.ru/pay/1" },
      }),
    );

    const res = await provider.createPayment(baseInput());

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.yookassa.ru/v3/payments");
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe(
      `Basic ${Buffer.from("shop-1:secret-1").toString("base64")}`,
    );
    expect(opts.headers["Idempotence-Key"]).toBe("idem-1");
    const body = JSON.parse(opts.body);
    expect(body.amount).toEqual({ value: "4990.50", currency: "RUB" });
    expect(body.capture).toBe(true);
    expect(body.confirmation).toEqual({
      type: "redirect",
      return_url: "https://maestria.edu/payment/internal-pay-1",
    });
    expect(body.description).toBe("Курс «TypeScript»");
    expect(body.metadata).toEqual({ paymentId: "internal-pay-1", courseId: "c1" });
    expect(body.payment_method_data).toEqual({ type: "bank_card" });
    expect(res).toMatchObject({
      providerPaymentId: "24b9c9b4-000f",
      status: "pending",
      confirmationUrl: "https://yoomoney.ru/pay/1",
    });
  });

  it("maps payment methods to YooKassa payment_method_data types", async () => {
    const cases: Array<[CreatePaymentInput["method"], string]> = [
      ["CARD", "bank_card"],
      ["SBP", "sbp"],
      ["YOOMONEY", "yoo_money"],
      ["SBERPAY", "sberbank"],
      ["TPAY", "tinkoff_bank"],
      ["YANDEX_PAY", "yoo_money"], // served via the YooMoney wallet
    ];
    fetchMock.mockResolvedValue(
      jsonResponse({ id: "yoo-2", status: "pending" }),
    );

    for (const [method] of cases) {
      await provider.createPayment(baseInput({ method }));
    }

    expect(fetchMock).toHaveBeenCalledTimes(cases.length);
    cases.forEach(([, expectedType], i) => {
      const body = JSON.parse(fetchMock.mock.calls[i][1].body);
      expect(body.payment_method_data).toEqual({ type: expectedType });
    });
  });

  it("includes the translated receipt when provided", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "yoo-3", status: "pending" }));

    await provider.createPayment(
      baseInput({
        receipt: {
          customer: { email: "student@example.com", phone: "+79001234567", fullName: "Иванов Иван" },
          items: [
            {
              description: "Доступ к курсу",
              amount: 4990.5,
              quantity: 1,
              vatCode: 1,
              paymentMode: "full_payment",
              paymentSubject: "service",
            },
          ],
          taxSystemCode: 1,
        },
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.receipt).toEqual({
      customer: {
        email: "student@example.com",
        phone: "+79001234567",
        full_name: "Иванов Иван",
      },
      items: [
        {
          description: "Доступ к курсу",
          quantity: "1",
          amount: { value: "4990.50", currency: "RUB" },
          vat_code: 1,
          payment_mode: "full_payment",
          payment_subject: "service",
        },
      ],
      tax_system_code: 1,
    });
  });

  it("returns no confirmationUrl and warns when YooKassa omits confirmation", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "yoo-4", status: "pending" }));

    const res = await provider.createPayment(baseInput());
    expect(res.confirmationUrl).toBeUndefined();
    expect(res.status).toBe("pending");
  });

  it("wraps network failures into a readable error", async () => {
    fetchMock.mockRejectedValue(new Error("boom"));
    await expect(provider.createPayment(baseInput())).rejects.toThrow(
      /YooKassa network error: boom/,
    );
  });

  it("throws code + description from the provider error envelope", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { type: "error", id: "e1", code: "invalid_request", description: "bad amount" },
        { ok: false, status: 400 },
      ),
    );
    await expect(provider.createPayment(baseInput())).rejects.toThrow(
      /YooKassa invalid_request: bad amount/,
    );
  });

  it("falls back to HTTP status when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);
    await expect(provider.createPayment(baseInput())).rejects.toThrow(
      /YooKassa unknown: HTTP 502/,
    );
  });
});

describe("capturePayment / cancelPayment / refundPayment / getPaymentStatus", () => {
  it("captures to the provider capture endpoint and sets paidAt for paid payments", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: "yoo-1", status: "succeeded", paid: true }),
    );

    const res = await provider.capturePayment({
      providerPaymentId: "yoo-1",
      amount: 100,
      idempotenceKey: "idem-capture",
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.yookassa.ru/v3/payments/yoo-1/capture");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      amount: { value: "100.00", currency: "RUB" },
    });
    expect(res.status).toBe("completed");
    expect(res.paidAt).toBeInstanceOf(Date);
  });

  it("omits paidAt when the payment is not marked paid", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "yoo-1", status: "succeeded", paid: false }));
    const res = await provider.capturePayment({
      providerPaymentId: "yoo-1",
      amount: 100,
      idempotenceKey: "idem",
    });
    expect(res.paidAt).toBeUndefined();
  });

  it("cancels with an empty body and maps canceled → failed", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "yoo-1", status: "canceled" }));

    const res = await provider.cancelPayment("yoo-1", "idem-cancel");

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.yookassa.ru/v3/payments/yoo-1/cancel");
    expect(fetchMock.mock.calls[0][1].body).toBe("{}");
    expect(res.status).toBe("failed");
  });

  it("refunds against /refunds and passes status through", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "refund-1", status: "pending" }));

    const res = await provider.refundPayment({
      providerPaymentId: "yoo-1",
      amount: 250.55,
      idempotenceKey: "idem-refund",
      description: "частичный возврат",
    });

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.yookassa.ru/v3/refunds");
    expect(JSON.parse(opts.body)).toEqual({
      payment_id: "yoo-1",
      amount: { value: "250.55", currency: "RUB" },
      description: "частичный возврат",
    });
    expect(res).toEqual({ providerRefundId: "refund-1", status: "pending" });
  });

  it("polls status via GET with no body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "yoo-1", status: "waiting_for_capture" }));

    const status = await provider.getPaymentStatus("yoo-1");

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.yookassa.ru/v3/payments/yoo-1");
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].headers["Idempotence-Key"]).toBeTruthy();
    expect(status).toBe("pending"); // waiting_for_capture → pending
  });
});

describe("verifyWebhook", () => {
  it("accepts a valid hex HMAC signature", () => {
    const ctx = webhookCtx();
    const signature = expectedHmac("secret-1", ctx.rawBody, "hex");
    expect(
      provider.verifyWebhook(webhookCtx({ headers: { "x-webhook-signature": signature } }), {}),
    ).toBe(true);
  });

  it("accepts a valid base64 HMAC signature", () => {
    const ctx = webhookCtx();
    const signature = expectedHmac("secret-1", ctx.rawBody, "base64");
    expect(
      provider.verifyWebhook(webhookCtx({ headers: { "x-webhook-signature": signature } }), {}),
    ).toBe(true);
  });

  it("rejects a signature computed with a different secret", () => {
    const ctx = webhookCtx();
    const signature = expectedHmac("attacker-secret", ctx.rawBody, "hex");
    expect(
      provider.verifyWebhook(webhookCtx({ headers: { "x-webhook-signature": signature } }), {}),
    ).toBe(false);
  });

  it("rejects a tampered body (signature no longer matches)", () => {
    const ctx = webhookCtx();
    const signature = expectedHmac("secret-1", ctx.rawBody, "hex");
    expect(
      provider.verifyWebhook(
        webhookCtx({
          rawBody: ctx.rawBody.replace("succeeded", "canceled"),
          headers: { "x-webhook-signature": signature },
        }),
        {},
      ),
    ).toBe(false);
  });

  it("falls back to the IP whitelist when no signature is present", () => {
    expect(provider.verifyWebhook(webhookCtx({ clientIp: YOOKASSA_IP }), {})).toBe(true);
    expect(provider.verifyWebhook(webhookCtx({ clientIp: OUTSIDE_IP }), {})).toBe(false);
    expect(provider.verifyWebhook(webhookCtx({ clientIp: undefined }), {})).toBe(false);
  });

  it("falls back to the IP whitelist when a signature is present but no secret is configured", () => {
    mockEnv.yooKassaSecretKey = undefined;
    // Signature alone means nothing without a secret — IP decides.
    expect(
      provider.verifyWebhook(
        webhookCtx({ clientIp: OUTSIDE_IP, headers: { "x-webhook-signature": "abc" } }),
        {},
      ),
    ).toBe(false);
    expect(
      provider.verifyWebhook(
        webhookCtx({ clientIp: YOOKASSA_IP, headers: { "x-webhook-signature": "abc" } }),
        {},
      ),
    ).toBe(true);
  });
});

describe("parseWebhook", () => {
  it("maps payment.succeeded with metadata and amount", () => {
    const parsed = provider.parseWebhook(
      {
        event: "payment.succeeded",
        object: {
          id: "yoo-1",
          status: "succeeded",
          amount: { value: "1500.75" },
          metadata: { paymentId: "internal-1" },
        },
      },
      webhookCtx(),
    );
    expect(parsed.eventId).toBe("payment.succeeded:yoo-1");
    expect(parsed.event).toBe("payment.succeeded");
    expect(parsed.providerPaymentId).toBe("yoo-1");
    expect(parsed.internalPaymentId).toBe("internal-1");
    expect(parsed.status).toBe("completed");
    expect(parsed.amount).toBe(1500.75);
  });

  it("prefers the provider eventId when present", () => {
    const parsed = provider.parseWebhook(
      {
        event: "payment.canceled",
        eventId: "evt-42",
        object: { id: "yoo-1", status: "canceled" },
      },
      webhookCtx(),
    );
    expect(parsed.eventId).toBe("evt-42");
    expect(parsed.status).toBe("failed");
  });

  it("derives the event name from a legacy bare status payload", () => {
    const cases: Array<[string, string]> = [
      ["succeeded", "payment.succeeded"],
      ["canceled", "payment.canceled"],
      ["waiting_for_capture", "payment.waiting_for_capture"],
      ["pending", "payment.pending"],
    ];
    for (const [status, expectedEvent] of cases) {
      const parsed = provider.parseWebhook(
        { object: { id: "yoo-legacy", status } },
        webhookCtx(),
      );
      expect(parsed.event).toBe(expectedEvent);
      expect(parsed.eventId).toBe(`${expectedEvent}:yoo-legacy`);
    }
  });

  it("falls back to the top-level status for generic payloads", () => {
    const parsed = provider.parseWebhook(
      { status: "canceled", object: { id: "", status: "" } },
      webhookCtx(),
    );
    expect(parsed.event).toBe("payment.canceled");
    expect(parsed.status).toBe("failed");
  });

  it("falls back to legacy paymentId / transactionId identifiers", () => {
    const withLegacyPaymentId = provider.parseWebhook(
      { event: "payment.succeeded", object: { id: "yoo-1", status: "succeeded", paymentId: "legacy-1" } },
      webhookCtx(),
    );
    expect(withLegacyPaymentId.internalPaymentId).toBe("legacy-1");

    // fallback срабатывает только при отсутствии id (undefined), не при ""
    const withTransactionId = provider.parseWebhook(
      { event: "payment.succeeded", object: { status: "succeeded", transactionId: "tx-9" } },
      webhookCtx(),
    );
    expect(withTransactionId.providerPaymentId).toBe("tx-9");
  });

  it("parses refund events using payment_id as the original payment", () => {
    const succeeded = provider.parseWebhook(
      {
        event: "refund.succeeded",
        object: {
          id: "refund-1",
          status: "succeeded",
          payment_id: "yoo-1",
          amount: { value: "500.00" },
        },
      },
      webhookCtx(),
    );
    expect(succeeded.event).toBe("refund.succeeded");
    expect(succeeded.providerPaymentId).toBe("yoo-1");
    expect(succeeded.status).toBe("refunded");
    expect(succeeded.amount).toBe(500);

    const pending = provider.parseWebhook(
      { event: "refund.pending", object: { id: "refund-2", payment_id: "yoo-1" } },
      webhookCtx(),
    );
    expect(pending.status).toBe("pending");
  });

  it("throws when both event and status are missing", () => {
    expect(() => provider.parseWebhook({ object: { id: "yoo-1" } }, webhookCtx())).toThrow(
      /missing event\/status/,
    );
  });

  it("tolerates a payload without an object", () => {
    const parsed = provider.parseWebhook({ status: "succeeded" }, webhookCtx());
    expect(parsed.event).toBe("payment.succeeded");
    expect(parsed.providerPaymentId).toBe("");
  });
});
