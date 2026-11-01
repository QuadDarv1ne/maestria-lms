// @vitest-environment node
/**
 * Unit tests for the CloudPayments provider: Basic-auth request envelope,
 * amount/method mapping, 54-ФЗ receipt translation, webhook HMAC
 * verification (X-Content-HMAC) and webhook event parsing.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    cloudPaymentsPublicId: undefined,
    cloudPaymentsApiSecret: undefined,
  } as Record<string, string | undefined>,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { CloudPaymentsProvider } from "@/lib/payments/providers/cloudpayments";
import type { CreatePaymentInput, WebhookContext } from "@/lib/payments/types";

const API_URL = "https://api.cloudpayments.ru";
const fetchMock = vi.fn();

/** Последнее обращение к замоканному fetch (URL + сериализованный body). */
function lastFetchCall(): [string, { body: string }] {
  const calls = fetchMock.mock.calls as Array<[string, { body: string }]>;
  return calls[calls.length - 1];
}

function ok(model: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ Success: true, Model: model }),
    text: async () => "",
  } as unknown as Response;
}

function fail(message: string) {
  return {
    ok: false,
    status: 200,
    json: async () => ({ Success: false, Message: message }),
    text: async () => JSON.stringify({ Success: false, Message: message }),
  } as unknown as Response;
}

function resetEnv() {
  mockEnv.cloudPaymentsPublicId = "shop-public-id";
  mockEnv.cloudPaymentsApiSecret = "api-secret";
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
    customer: { email: "student@example.com", phone: "+79990000000" },
    metadata: { courseId: "c1" },
    ...overrides,
  };
}

function webhookCtx(overrides: Partial<WebhookContext> = {}): WebhookContext {
  return {
    rawBody: '{"TransactionId":123,"InvoiceId":"internal-1","Status":"Completed"}',
    headers: {},
    clientIp: undefined,
    provider: "CLOUDPAYMENTS",
    ...overrides,
  };
}

function hmac(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("base64");
}

let provider: CloudPaymentsProvider;

beforeEach(() => {
  resetEnv();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  provider = new CloudPaymentsProvider();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("configuration & auth envelope", () => {
  it("isConfigured requires publicId and apiSecret", () => {
    expect(provider.isConfigured()).toBe(true);
    mockEnv.cloudPaymentsPublicId = undefined;
    expect(provider.isConfigured()).toBe(false);
  });

  it("sends HTTP Basic with publicId:apiSecret and JSON body", async () => {
    fetchMock.mockResolvedValue(ok({ Id: "cp-1", Url: "https://cp/pay/1" }));
    await provider.createPayment(baseInput());

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/orders/create`);
    const expectedAuth = `Basic ${Buffer.from("shop-public-id:api-secret").toString("base64")}`;
    expect(opts.headers.Authorization).toBe(expectedAuth);
    expect(opts.headers["Content-Type"]).toBe("application/json");
  });

  it("wraps network failures into a readable error", async () => {
    fetchMock.mockRejectedValue(new Error("socket hang up"));
    await expect(provider.createPayment(baseInput())).rejects.toThrow(
      /CloudPayments network error: socket hang up/,
    );
  });

  it("throws with the API message when Success is false", async () => {
    fetchMock.mockResolvedValue(fail("Invalid publicId"));
    await expect(provider.createPayment(baseInput())).rejects.toThrow(
      /CloudPayments: Invalid publicId/,
    );
  });

  it("falls back to a generic message when the API omits it", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ Success: false }),
      text: async () => "",
    } as unknown as Response);
    await expect(provider.createPayment(baseInput())).rejects.toThrow(/request failed/);
  });
});

describe("createPayment", () => {
  it("passes the amount in rubles with the invoice id and json metadata", async () => {
    fetchMock.mockResolvedValue(ok({ Id: 777, Url: "https://cp/pay/777" }));
    const res = await provider.createPayment(baseInput());

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.Amount).toBe(4990.5); // не копейки — CloudPayments принимает рубли
    expect(body.Currency).toBe("RUB");
    expect(body.InvoiceId).toBe("internal-pay-1");
    expect(body.Email).toBe("student@example.com");
    expect(body.Phone).toBe("+79990000000");
    expect(body.JsonData).toEqual({ paymentId: "internal-pay-1", courseId: "c1" });
    expect(body.PaymentMethod).toBeUndefined();
    expect(res).toMatchObject({
      providerPaymentId: "777",
      status: "pending",
      confirmationUrl: "https://cp/pay/777",
    });
  });

  it("requests the QR schema for SBP and maps wallet methods", async () => {
    const cases: Array<[string, string]> = [
      ["SBP", "SBP"],
      ["YOOMONEY", "YooMoney"],
      ["SBERPAY", "Sberbank"],
      ["TPAY", "TinkoffPay"],
    ];
    for (const [method, expected] of cases) {
      fetchMock.mockResolvedValue(ok({ Id: 1, Url: "u", QrUrl: "https://qr" }));
      const res = await provider.createPayment(
        baseInput({ method: method as CreatePaymentInput["method"] }),
      );
      const body = JSON.parse(lastFetchCall()[1].body);
      expect(body.PaymentMethod).toBe(expected);
      if (method === "SBP") {
        expect(body.Schema).toBe("QR");
        expect(res.qrCode).toBe("https://qr");
      } else {
        expect(body.Schema).toBeUndefined();
      }
    }
  });

  it("translates the 54-ФЗ receipt into the CloudPayments shape", async () => {
    fetchMock.mockResolvedValue(ok({ Id: 1, Url: "u" }));
    await provider.createPayment(
      baseInput({
        receipt: {
          customer: { email: "buy@ex.com", phone: "+7000" },
          taxSystemCode: 3,
          items: [
            {
              description: "Доступ к курсу",
              amount: 2000,
              quantity: 2,
              vatCode: 1,
              paymentMode: "full_payment",
              paymentSubject: "service",
            },
          ],
        },
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.Receipt).toEqual({
      Items: [
        {
          label: "Доступ к курсу",
          price: 2000,
          quantity: 2,
          amount: 4000,
          vat: 1,
          method: "full_payment",
          object: "service",
        },
      ],
      taxationSystem: 3,
      email: "buy@ex.com",
      phone: "+7000",
    });
  });

  it("defaults taxationSystem to 0 when no tax system code is given", async () => {
    fetchMock.mockResolvedValue(ok({ Id: 1, Url: "u" }));
    await provider.createPayment(
      baseInput({
        receipt: {
          customer: { email: "buy@ex.com" },
          items: [
            {
              description: "Курс",
              amount: 100,
              quantity: 1,
              vatCode: 4,
              paymentMode: "full_payment",
              paymentSubject: "service",
            },
          ],
        },
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.Receipt.taxationSystem).toBe(0);
  });
});

describe("cancel / refund / status", () => {
  it("cancelPayment posts the numeric id and reports failed", async () => {
    fetchMock.mockResolvedValue(ok({ Id: 5 }));
    const res = await provider.cancelPayment("123", "idem");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ Id: 123 });
    expect(res).toMatchObject({ providerPaymentId: "123", status: "failed" });
  });

  it("refundPayment maps Succeeded and keeps others pending", async () => {
    fetchMock.mockResolvedValue(ok({ TransactionId: 999, Status: "Succeeded" }));
    const res = await provider.refundPayment({
      providerPaymentId: "123",
      amount: 500,
      idempotenceKey: "idem",
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ TransactionId: 123, Amount: 500 });
    expect(res).toEqual({ providerRefundId: "999", status: "succeeded" });

    fetchMock.mockResolvedValue(ok({ TransactionId: 1000, Status: "Processing" }));
    const pending = await provider.refundPayment({
      providerPaymentId: "123",
      amount: 500,
      idempotenceKey: "idem2",
    });
    expect(pending.status).toBe("pending");
  });

  it("getPaymentStatus maps provider statuses", async () => {
    const cases: Array<[string, string]> = [
      ["Completed", "completed"],
      ["Authorized", "pending"],
      ["AwaitingAuthentication", "pending"],
      ["Declined", "failed"],
      ["Cancelled", "failed"],
      ["Refunded", "refunded"],
      ["PartialRefund", "refunded"],
      ["SomethingNew", "pending"], // неизвестный статус — ждём дальше
    ];
    for (const [raw, expected] of cases) {
      fetchMock.mockResolvedValue(ok({ Status: raw }));
      await expect(provider.getPaymentStatus("123")).resolves.toBe(expected);
    }
  });
});

describe("verifyWebhook", () => {
  it("accepts a valid X-Content-HMAC signature", () => {
    const ctx = webhookCtx();
    const signature = hmac("api-secret", ctx.rawBody);
    expect(
      provider.verifyWebhook(webhookCtx({ headers: { "x-content-hmac": signature } }), {}),
    ).toBe(true);
  });

  it("rejects missing signature or missing secret", () => {
    expect(provider.verifyWebhook(webhookCtx(), {})).toBe(false);
    mockEnv.cloudPaymentsApiSecret = undefined;
    expect(
      provider.verifyWebhook(webhookCtx({ headers: { "x-content-hmac": "abc" } }), {}),
    ).toBe(false);
  });

  it("rejects signatures of different length and same-length forgeries", () => {
    expect(
      provider.verifyWebhook(webhookCtx({ headers: { "x-content-hmac": "short" } }), {}),
    ).toBe(false);

    // Подпись, снятая с другого секрета, имеет ту же длину (base64 HMAC
    // фиксированной длины), поэтому length-check её не отсеет — должен
    // сработать timingSafeEqual.
    const ctx = webhookCtx();
    const signature = hmac("api-secret", ctx.rawBody);
    const wrongKey = hmac("other-secret", ctx.rawBody);
    expect(wrongKey.length).toBe(signature.length);
    expect(wrongKey).not.toBe(signature);
    expect(
      provider.verifyWebhook(webhookCtx({ headers: { "x-content-hmac": wrongKey } }), {}),
    ).toBe(false);

    // Обрезанная/дополненная копия валидной подписи — разная длина.
    expect(
      provider.verifyWebhook(webhookCtx({ headers: { "x-content-hmac": signature.slice(0, -2) } }), {}),
    ).toBe(false);
  });
});

describe("parseWebhook", () => {
  it("parses a completed payment event", () => {
    const parsed = provider.parseWebhook(
      { TransactionId: 123, InvoiceId: "internal-1", Status: "Completed", EventType: "Pay" },
      webhookCtx(),
    );
    expect(parsed.eventId).toBe("cp:123:Pay");
    expect(parsed.event).toBe("payment.completed");
    expect(parsed.providerPaymentId).toBe("123");
    expect(parsed.internalPaymentId).toBe("internal-1");
    expect(parsed.status).toBe("completed");
  });

  it("treats any refund-ish event type as a succeeded refund", () => {
    const parsed = provider.parseWebhook(
      { TransactionId: 123, InvoiceId: "internal-1", Status: "Completed", EventType: "Refund" },
      webhookCtx(),
    );
    expect(parsed.event).toBe("refund.succeeded");
    expect(parsed.status).toBe("refunded");
  });

  it("falls back to Event, then to an empty event type", () => {
    const parsed = provider.parseWebhook(
      { TransactionId: 1, InvoiceId: "i", Status: "Declined", Event: "payFail" },
      webhookCtx(),
    );
    expect(parsed.eventId).toBe("cp:1:payFail");
    expect(parsed.event).toBe("payment.declined");
    expect(parsed.status).toBe("failed");

    const noType = provider.parseWebhook({ TransactionId: 2, Status: "Completed" }, webhookCtx());
    expect(noType.eventId).toBe("cp:2:");
    expect(noType.internalPaymentId).toBeUndefined();
  });

  it("defaults the transaction id to an empty string when absent", () => {
    const parsed = provider.parseWebhook({ InvoiceId: "i" }, webhookCtx());
    expect(parsed.providerPaymentId).toBe("");
    expect(parsed.status).toBe("pending"); // Status отсутствует → default pending
  });
});
