// @vitest-environment node
/**
 * Unit tests for the T-Bank (Tinkoff) provider: request Token signing,
 * Init/Cancel/Refund/GetState payloads, status mapping and webhook
 * verification.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    tinkoffTerminalKey: undefined,
    tinkoffPassword: undefined,
    siteUrl: "https://maestria.edu",
  } as Record<string, string | undefined>,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { TinkoffProvider } from "@/lib/payments/providers/tinkoff";
import type { CreatePaymentInput, WebhookContext } from "@/lib/payments/types";

const API_URL = "https://securepay.tinkoff.ru/v2";
const fetchMock = vi.fn();

/** Последнее обращение к замоканному fetch (URL + сериализованный body). */
function lastFetchCall(): [string, { body: string }] {
  const calls = fetchMock.mock.calls as Array<[string, { body: string }]>;
  return calls[calls.length - 1];
}

function resp(body: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/** Reference implementation of the documented Tinkoff token algorithm. */
function tinkoffToken(payload: Record<string, unknown>, password: string): string {
  const values: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (key === "Token" || key === "DATA") continue;
    if (value === undefined || value === null) continue;
    values.push(String(value));
  }
  values.sort();
  values.push(password);
  return crypto.createHash("sha256").update(values.join("")).digest("hex");
}

function baseInput(overrides: Partial<CreatePaymentInput> = {}): CreatePaymentInput {
  return {
    paymentId: "internal-pay-1",
    idempotenceKey: "idem-1",
    amount: 4990.5,
    currency: "RUB",
    description: "Курс \"TypeScript\"",
    returnUrl: "https://maestria.edu/payment/internal-pay-1",
    method: "CARD",
    customer: { email: "student@example.com" },
    metadata: { courseId: "c1" },
    ...overrides,
  };
}

function webhookCtx(overrides: Partial<WebhookContext> = {}): WebhookContext {
  return {
    rawBody: "{}",
    headers: {},
    clientIp: undefined,
    provider: "TINKOFF",
    ...overrides,
  };
}

let provider: TinkoffProvider;

beforeEach(() => {
  mockEnv.tinkoffTerminalKey = "MAESTRIA.TEST";
  mockEnv.tinkoffPassword = "terminal-password";
  mockEnv.siteUrl = "https://maestria.edu";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  provider = new TinkoffProvider();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("configuration", () => {
  it("isConfigured needs both TerminalKey and Password", () => {
    expect(provider.isConfigured()).toBe(true);
    mockEnv.tinkoffTerminalKey = undefined;
    expect(provider.isConfigured()).toBe(false);
    mockEnv.tinkoffTerminalKey = "MAESTRIA.TEST";
    mockEnv.tinkoffPassword = undefined;
    expect(provider.isConfigured()).toBe(false);
  });

  it("missing credentials surface an actionable error, not a silent one", async () => {
    mockEnv.tinkoffPassword = undefined;
    await expect(provider.createPayment(baseInput())).rejects.toThrow(/TINKOFF_PASSWORD/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("request signing", () => {
  it("attaches TerminalKey and a Token matching the documented algorithm", async () => {
    fetchMock.mockResolvedValue(
      resp({ Success: true, PaymentId: "tk-1", PaymentURL: "https://pay", OrderId: "o" }),
    );

    await provider.createPayment(baseInput());

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/Init`);
    const sent = JSON.parse(opts.body);
    expect(sent.TerminalKey).toBe("MAESTRIA.TEST");
    expect(sent.Token).toBe(tinkoffToken(sent, "terminal-password"));
    expect(sent.Token).toHaveLength(64);
  });

  it("the token changes when a payload value is tampered with", async () => {
    fetchMock.mockResolvedValue(resp({ Success: true, PaymentId: "tk-1" }));
    await provider.createPayment(baseInput());
    const original = JSON.parse(fetchMock.mock.calls[0][1].body).Token;

    fetchMock.mockResolvedValue(resp({ Success: true, PaymentId: "tk-1" }));
    await provider.createPayment(baseInput({ amount: 1 }));
    const changed = JSON.parse(lastFetchCall()[1].body).Token;

    expect(changed).not.toBe(original);
  });
});

describe("createPayment", () => {
  it("sends kopecks, order id, success/fail urls and the notification url", async () => {
    fetchMock.mockResolvedValue(
      resp({ Success: true, PaymentId: "tk-42", PaymentURL: "https://tinkoff/pay/42" }),
    );

    const res = await provider.createPayment(baseInput());

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.Amount).toBe(499050);
    expect(sent.OrderId).toBe("internal-pay-1");
    expect(sent.SuccessURL).toBe("https://maestria.edu/payment/internal-pay-1");
    expect(sent.FailURL).toBe("https://maestria.edu/payment/internal-pay-1?status=fail");
    expect(sent.NotificationURL).toBe(
      "https://maestria.edu/api/payments/webhook?provider=TINKOFF",
    );
    expect(sent.DATA).toEqual({ paymentId: "internal-pay-1" });
    expect(res).toMatchObject({
      providerPaymentId: "tk-42",
      status: "pending",
      confirmationUrl: "https://tinkoff/pay/42",
    });
  });

  it("hints the pre-selected method for SBP and T-Pay", async () => {
    fetchMock.mockResolvedValue(resp({ Success: true, PaymentId: "tk-1" }));
    await provider.createPayment(baseInput({ method: "SBP" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).DATA.PayType).toBe("SBP");

    fetchMock.mockResolvedValue(resp({ Success: true, PaymentId: "tk-1" }));
    await provider.createPayment(baseInput({ method: "TPAY" }));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).DATA.PayType).toBe("TinkoffPay");
  });

  it("fails loudly when the API reports Success:false or omits PaymentId", async () => {
    fetchMock.mockResolvedValue(
      resp({ Success: false, ErrorCode: "0001", Message: "Invalid Token" }),
    );
    await expect(provider.createPayment(baseInput())).rejects.toThrow(
      /Tinkoff 0001: Invalid Token/,
    );

    fetchMock.mockResolvedValue(resp({ Success: true, Message: "no id" }));
    await expect(provider.createPayment(baseInput())).rejects.toThrow(/no PaymentId/);
  });

  it("wraps network failures", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    await expect(provider.createPayment(baseInput())).rejects.toThrow(
      /Tinkoff network error: ECONNRESET/,
    );
  });
});

describe("cancel / refund / status", () => {
  it("cancel maps CANCELLED to failed and anything else to pending", async () => {
    fetchMock.mockResolvedValue(resp({ Success: true, Status: "CANCELLED" }));
    const cancelled = await provider.cancelPayment("tk-1", "idem-key");
    expect(cancelled.status).toBe("failed");
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.PaymentId).toBe("tk-1");
    expect(sent.Ip).toBe("idem-key");

    fetchMock.mockResolvedValue(resp({ Success: true, Status: "CONFIRMED" }));
    const other = await provider.cancelPayment("tk-1", "k".repeat(50));
    expect(other.status).toBe("pending");
    // Поле Ip ограничено 39 символами — длинные ключи обрезаются.
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).Ip).toHaveLength(39);
  });

  it("refund sends kopecks and maps REFUNDED", async () => {
    fetchMock.mockResolvedValue(resp({ Success: true, PaymentId: "rf-1", Status: "REFUNDED" }));
    const res = await provider.refundPayment({
      providerPaymentId: "tk-1",
      amount: 1000.4,
      idempotenceKey: "idem",
    });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.Amount).toBe(100040);
    expect(res).toEqual({ providerRefundId: "rf-1", status: "succeeded" });

    fetchMock.mockResolvedValue(resp({ Success: true, PaymentId: "rf-2", Status: "PROCESSING" }));
    const pending = await provider.refundPayment({
      providerPaymentId: "tk-1",
      amount: 10,
      idempotenceKey: "idem",
    });
    expect(pending.status).toBe("pending");
  });

  it("GetState maps the documented uppercase statuses", async () => {
    const cases: Array<[string, string]> = [
      ["NEW", "pending"],
      ["FORM_SHOWED", "pending"],
      ["AUTHORIZED", "pending"],
      ["CHECKING", "pending"],
      ["CONFIRMED", "completed"],
      ["REVERSED", "failed"],
      ["REJECTED", "failed"],
      ["REFUNDED", "refunded"],
      ["PARTIAL_REFUNDED", "refunded"],
      ["SOMETHING_ELSE", "failed"],
      ["confirmed", "failed"], // регистр значим — провайдер шлёт UPPERCASE
    ];
    for (const [raw, expected] of cases) {
      fetchMock.mockResolvedValue(resp({ Success: true, Status: raw }));
      await expect(provider.getPaymentStatus("tk-1")).resolves.toBe(expected);
    }
  });
});

describe("verifyWebhook", () => {
  function signedBody(overrides: Record<string, unknown> = {}) {
    const body = {
      TerminalKey: "MAESTRIA.TEST",
      OrderId: "internal-pay-1",
      PaymentId: "tk-1",
      Status: "CONFIRMED",
      Amount: 499050,
      ...overrides,
    };
    return { ...body, Token: tinkoffToken(body, "terminal-password") };
  }

  it("accepts a correctly signed notification", () => {
    const body = signedBody();
    expect(provider.verifyWebhook(webhookCtx(), body)).toBe(true);
  });

  it("rejects a tampered status even with the original token", () => {
    const body = signedBody();
    expect(
      provider.verifyWebhook(webhookCtx(), { ...body, Status: "REFUNDED" }),
    ).toBe(false);
  });

  it("rejects a missing or non-string token", () => {
    const body = signedBody();
    const { Token: _token, ...unsigned } = body;
    expect(provider.verifyWebhook(webhookCtx(), unsigned)).toBe(false);
    expect(provider.verifyWebhook(webhookCtx(), { ...body, Token: 12345 })).toBe(false);
  });

  it("ignores DATA when recomputing the signature (nested object is not signed)", () => {
    const body = signedBody({ DATA: { paymentId: "internal-pay-1" } });
    expect(provider.verifyWebhook(webhookCtx(), body)).toBe(true);
  });

  it("rejects instead of throwing when the terminal password is not configured", () => {
    // verifyWebhook is called from the public webhook route: an unconfigured
    // merchant must get a clean 401, not a 500 from a thrown Error.
    mockEnv.tinkoffPassword = undefined;
    const body = signedBody();
    expect(() => provider.verifyWebhook(webhookCtx(), body)).not.toThrow();
    expect(provider.verifyWebhook(webhookCtx(), body)).toBe(false);
  });
});

describe("parseWebhook", () => {
  it("normalises a confirmed payment and takes internal id from OrderId", () => {
    const parsed = provider.parseWebhook(
      { OperationId: "op-1", PaymentId: "tk-1", OrderId: "internal-1", Status: "CONFIRMED" },
      webhookCtx(),
    );
    expect(parsed.eventId).toBe("tinkoff:op-1:CONFIRMED");
    expect(parsed.event).toBe("payment.confirmed");
    expect(parsed.providerPaymentId).toBe("tk-1");
    expect(parsed.internalPaymentId).toBe("internal-1");
    expect(parsed.status).toBe("completed");
  });

  it("falls back to PaymentId and an empty status", () => {
    const parsed = provider.parseWebhook({ PaymentId: "tk-2" }, webhookCtx());
    expect(parsed.eventId).toBe("tinkoff:tk-2:");
    expect(parsed.event).toBe("payment.unknown");
    expect(parsed.status).toBe("failed");
    expect(parsed.internalPaymentId).toBeUndefined();
  });

  it("handles a totally empty payload", () => {
    const parsed = provider.parseWebhook({}, webhookCtx());
    expect(parsed.eventId).toBe("tinkoff::");
    expect(parsed.providerPaymentId).toBe("");
  });
});
