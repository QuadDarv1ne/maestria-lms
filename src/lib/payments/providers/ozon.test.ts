// @vitest-environment node
/**
 * Unit tests for the Ozon Seller (Ozon Pay) provider: request shapes against
 * a stubbed fetch, response mapping, and — most importantly — the webhook
 * verification security posture.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    ozonClientId: undefined,
    ozonApiKey: undefined,
    ozonApiUrl: undefined,
    ozonWebhookSecret: undefined,
  } as Record<string, string | undefined>,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { OzonProvider } from "@/lib/payments/providers/ozon";
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
  mockEnv.ozonClientId = "client-1";
  mockEnv.ozonApiKey = "api-key-1";
  mockEnv.ozonApiUrl = undefined;
  mockEnv.ozonWebhookSecret = undefined;
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
    rawBody: '{"payment_id":"p1","order_id":"o1","status":"Approved"}',
    headers: {},
    clientIp: undefined,
    provider: "OZON",
    ...overrides,
  };
}

function expectedHmac(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("base64");
}

let provider: OzonProvider;

beforeEach(() => {
  resetEnv();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  provider = new OzonProvider();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("configuration", () => {
  it("isConfigured requires both Client-Id and Api-Key", () => {
    expect(provider.isConfigured()).toBe(true);
    mockEnv.ozonClientId = undefined;
    expect(provider.isConfigured()).toBe(false);
    mockEnv.ozonClientId = "client-1";
    mockEnv.ozonApiKey = undefined;
    expect(provider.isConfigured()).toBe(false);
  });

  it("createPayment without credentials fails before any network call", async () => {
    mockEnv.ozonApiKey = undefined;
    await expect(provider.createPayment(baseInput())).rejects.toThrow(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("createPayment", () => {
  it("posts kopecks, order id and card method to the default base URL", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ result: { payment_id: "ozon-1", payment_url: "https://pay.ozon/1" } }),
    );

    const res = await provider.createPayment(baseInput());

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api-seller.ozon.ru/v1/payment/create");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Client-Id"]).toBe("client-1");
    expect(opts.headers["Api-Key"]).toBe("api-key-1");
    const body = JSON.parse(opts.body);
    expect(body.amount).toBe(499050); // рубли → копейки
    expect(body.order_id).toBe("internal-pay-1");
    expect(body.payment_method).toBe("card");
    expect(body.customer).toEqual({ email: "student@example.com" });
    expect(res).toMatchObject({
      providerPaymentId: "ozon-1",
      status: "pending",
      confirmationUrl: "https://pay.ozon/1",
    });
  });

  it("maps SBP and OZON_CARD methods and omits customer without email", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: { payment_id: "ozon-2" } }));

    await provider.createPayment(baseInput({ method: "SBP", customer: {} }));
    let body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.payment_method).toBe("sbp");
    expect(body.customer).toBeUndefined();

    await provider.createPayment(baseInput({ method: "OZON_CARD", customer: {} }));
    body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.payment_method).toBe("ozon_card");
  });

  it("honours a custom sandbox base URL from env", async () => {
    mockEnv.ozonApiUrl = "https://sandbox-api.ozon.ru";
    fetchMock.mockResolvedValue(jsonResponse({ result: { payment_id: "ozon-3" } }));

    await provider.createPayment(baseInput());
    expect(fetchMock.mock.calls[0][0]).toBe("https://sandbox-api.ozon.ru/v1/payment/create");
  });

  it("wraps network failures into a readable error", async () => {
    fetchMock.mockRejectedValue(new Error("boom"));
    await expect(provider.createPayment(baseInput())).rejects.toThrow(
      /Ozon network error: boom/,
    );
  });

  it("throws with status and body text on HTTP errors", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: "denied" }, { ok: false, status: 403 }),
    );
    await expect(provider.createPayment(baseInput())).rejects.toThrow(/^Ozon HTTP 403/);
  });

  it("throws the provider message when the result envelope is missing", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 1, message: "bad signature" }));
    await expect(provider.createPayment(baseInput())).rejects.toThrow(/bad signature/);
  });
});

describe("cancelPayment / refundPayment / getPaymentStatus", () => {
  it("maps a cancelled result to failed status", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: { status: "cancelled" } }));
    const res = await provider.cancelPayment("ozon-1", "idem");
    expect(res.status).toBe("failed");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ payment_id: "ozon-1" });
  });

  it("keeps non-cancelled results pending", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: { status: "processing" } }));
    const res = await provider.cancelPayment("ozon-1", "idem");
    expect(res.status).toBe("pending");
  });

  it("refunds in kopecks and passes the refund id through", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ result: { refund_id: "refund-9", status: "succeeded" } }),
    );
    const res = await provider.refundPayment({
      providerPaymentId: "ozon-1",
      amount: 1000.4,
      idempotenceKey: "idem",
      description: "возврат",
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.amount).toBe(100040);
    expect(res).toEqual({ providerRefundId: "refund-9", status: "succeeded" });
  });

  it("defaults refund fields when the result is empty", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const res = await provider.refundPayment({
      providerPaymentId: "ozon-1",
      amount: 10,
      idempotenceKey: "idem",
    });
    expect(res).toEqual({ providerRefundId: "", status: "pending" });
  });

  it("maps provider statuses case-insensitively", async () => {
    const cases: Array<[string, string]> = [
      ["Succeeded", "completed"],
      ["approved", "completed"],
      ["Pending", "pending"],
      ["Rejected", "failed"],
      ["Partially_Refunded", "refunded"],
      ["weird-status", "failed"],
      ["", "failed"],
    ];
    for (const [raw, expected] of cases) {
      fetchMock.mockResolvedValue(jsonResponse({ result: { status: raw } }));
      await expect(provider.getPaymentStatus("ozon-1")).resolves.toBe(expected);
    }
  });
});

describe("verifyWebhook", () => {
  it("rejects when no webhook secret is configured, even with a signature", () => {
    const body = webhookCtx();
    expect(provider.verifyWebhook(body, {})).toBe(false);
    mockEnv.ozonWebhookSecret = "wh-secret";
    expect(
      provider.verifyWebhook(
        webhookCtx({ headers: { "x-ozon-signature": "whatever" } }),
        {},
      ),
    ).toBe(false);
  });

  it("accepts a valid base64 HMAC signature", () => {
    mockEnv.ozonWebhookSecret = "wh-secret";
    const ctx = webhookCtx();
    const signature = expectedHmac("wh-secret", ctx.rawBody);
    expect(provider.verifyWebhook(webhookCtx({ headers: { "x-ozon-signature": signature } }), {})).toBe(
      true,
    );
  });

  it("rejects a tampered signature", () => {
    mockEnv.ozonWebhookSecret = "wh-secret";
    const ctx = webhookCtx();
    const signature = expectedHmac("wh-secret", ctx.rawBody);
    const tampered = signature.slice(0, -4) + "AAAA";
    expect(
      provider.verifyWebhook(webhookCtx({ headers: { "x-ozon-signature": tampered } }), {}),
    ).toBe(false);
  });

  it("rejects unsigned webhooks from arbitrary IPs (empty IP whitelist cannot vouch for them)", () => {
    // Ozon publishes no generic webhook IP ranges (ip-whitelist.ts OZON: []),
    // so `isIpAllowed` returns true for everyone — an unsigned request must
    // still be rejected, otherwise anyone could fake a payment.succeeded event.
    mockEnv.ozonWebhookSecret = "wh-secret";
    expect(provider.verifyWebhook(webhookCtx({ clientIp: "203.0.113.7" }), {})).toBe(false);
    expect(provider.verifyWebhook(webhookCtx({ clientIp: undefined }), {})).toBe(false);
  });
});

describe("parseWebhook", () => {
  it("builds a stable eventId and maps an approved payment", () => {
    const parsed = provider.parseWebhook(
      { webhook_id: "wh-1", payment_id: "ozon-1", order_id: "internal-1", status: "Approved", event: "payment.approved" },
      webhookCtx(),
    );
    expect(parsed.eventId).toBe("ozon:wh-1:payment.approved");
    expect(parsed.event).toBe("payment.approved");
    expect(parsed.providerPaymentId).toBe("ozon-1");
    expect(parsed.internalPaymentId).toBe("internal-1");
    expect(parsed.status).toBe("completed");
  });

  it("derives the event name from status when the payload has none", () => {
    const parsed = provider.parseWebhook(
      { payment_id: "ozon-2", status: "Succeeded" },
      webhookCtx(),
    );
    expect(parsed.eventId).toBe("ozon:ozon-2:Succeeded");
    expect(parsed.event).toBe("payment.succeeded");
    expect(parsed.status).toBe("completed");
  });

  it("maps unknown and missing statuses to failed", () => {
    const parsed = provider.parseWebhook({ payment_id: "ozon-3" }, webhookCtx());
    expect(parsed.event).toBe("payment.unknown");
    expect(parsed.status).toBe("failed");
    expect(parsed.eventId).toBe("ozon:ozon-3:");
  });
});
