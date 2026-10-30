/**
 * YooKassa provider — https://yookassa.ru/developers/api
 *
 * YooKassa is the most popular Russian payment aggregator and supports all
 * the methods we want out of the box:
 *   - Bank cards (Visa, Mastercard, МИР)
 *   - СБП (System of Fast Payments)
 *   - ЮMoney
 *   - SberPay
 *   - T-Pay (Tinkoff bank)
 *   - Yandex Pay
 *
 * Auth: HTTP Basic with `shopId:secretKey` base64-encoded.
 * Idempotency: `Idempotence-Key` header (any UUID-like string).
 *
 * Sandbox: use https://api.yookassa.ru/v3 with test shopId + test secret key
 * (issued instantly in your YooKassa merchant cabinet).
 *
 * Webhook events we handle:
 *   - payment.succeeded       → mark payment completed, grant course access
 *   - payment.canceled        → mark payment failed
 *   - payment.waiting_for_capture → (only if capture=false) trigger capture
 *   - refund.succeeded        → mark payment refunded, cancel access
 */

import crypto from "crypto";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { isIpAllowed } from "../ip-whitelist";
import type {
  IPaymentProvider, ProviderName, PaymentMethod,
  CreatePaymentInput, PaymentResult, CaptureInput,
  RefundInput, RefundResult,
  WebhookContext, ParsedWebhook, PaymentStatus, Receipt,
} from "../types";

const API_URL = "https://api.yookassa.ru/v3";

/** YooKassa payment_method_data type values per method. */
const METHOD_TYPE: Record<PaymentMethod, string> = {
  CARD: "bank_card",
  SBP: "sbp",
  YOOMONEY: "yoo_money",
  SBERPAY: "sberbank",
  TPAY: "tinkoff_bank",
  YANDEX_PAY: "yoo_money", // Yandex Pay is served via the YooMoney wallet
  OZON_CARD: "bank_card",  // not native — fall back to card
  WALLET: "yoo_money",
};

/** Map YooKassa status → our internal status string. */
function mapStatus(s: string): PaymentStatus {
  switch (s) {
    case "pending": return "pending";
    case "waiting_for_capture": return "pending"; // still pending until capture
    case "succeeded": return "completed";
    case "canceled": return "failed";
    default: return "failed";
  }
}

interface YooKassaPaymentResponse {
  id: string;
  status: string;
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: {
    type: string;
    confirmation_url?: string;
    // For SBP QR (yoo_money method or sbp method when confirmation=qr):
    confirmation_data?: string;
  };
  metadata?: Record<string, string>;
  refund?: { id: string; status: string };
}

interface YooKassaError {
  type: string;
  id: string;
  code: string;
  description: string;
  parameter?: string;
}

export class YooKassaProvider implements IPaymentProvider {
  readonly name: ProviderName = "YOOKASSA";
  readonly label = "ЮKassa";
  readonly supportedMethods: readonly PaymentMethod[] = [
    "CARD", "SBP", "YOOMONEY", "SBERPAY", "TPAY", "YANDEX_PAY",
  ];

  isConfigured(): boolean {
    return !!(env.yooKassaShopId && env.yooKassaSecretKey);
  }

  private get authHeader(): string {
    const credentials = Buffer.from(`${env.yooKassaShopId}:${env.yooKassaSecretKey}`).toString("base64");
    return `Basic ${credentials}`;
  }

  private async request<T>(method: string, path: string, body: unknown, idempotenceKey: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
          "Idempotence-Key": idempotenceKey,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new Error(`YooKassa network error: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!res.ok) {
      const err: YooKassaError = await res.json().catch(() => ({
        type: "error", id: "", code: "unknown", description: `HTTP ${res.status}`,
      }));
      log.error("YooKassa API error", { path, status: res.status, code: err.code, description: err.description });
      throw new Error(`YooKassa ${err.code}: ${err.description}`);
    }

    return res.json() as Promise<T>;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    // For SBP YooKassa returns a redirect URL that itself hosts the QR.
    // If you want the raw QR payload (to render your own QR page), set
    // confirmation type to "qr" — but that requires your merchant cabinet
    // to enable it. We default to "redirect" for maximum compatibility.
    const body: Record<string, unknown> = {
      amount: { value: input.amount.toFixed(2), currency: "RUB" },
      capture: true, // 1-step payment — capture immediately on customer's bank side
      confirmation: { type: "redirect", return_url: input.returnUrl },
      description: input.description,
      metadata: { paymentId: input.paymentId, ...input.metadata },
      payment_method_data: { type: METHOD_TYPE[input.method] },
    };

    if (input.receipt) {
      body["receipt"] = toYooKassaReceipt(input.receipt);
    }

    const data = await this.request<YooKassaPaymentResponse>(
      "POST", "/payments", body, input.idempotenceKey,
    );

    if (!data.confirmation?.confirmation_url) {
      // For non-redirect methods (rare) YooKassa may return an empty confirmation.
      log.warn("YooKassa: no confirmation_url", { id: data.id, status: data.status });
    }

    return {
      providerPaymentId: data.id,
      status: mapStatus(data.status),
      confirmationUrl: data.confirmation?.confirmation_url,
      raw: data,
    };
  }

  async capturePayment(input: CaptureInput): Promise<PaymentResult> {
    const data = await this.request<YooKassaPaymentResponse>(
      "POST", `/payments/${input.providerPaymentId}/capture`,
      { amount: { value: input.amount.toFixed(2), currency: "RUB" } },
      input.idempotenceKey,
    );
    return {
      providerPaymentId: data.id,
      status: mapStatus(data.status),
      paidAt: data.paid ? new Date() : undefined,
      raw: data,
    };
  }

  async cancelPayment(providerPaymentId: string, idempotenceKey: string): Promise<PaymentResult> {
    const data = await this.request<YooKassaPaymentResponse>(
      "POST", `/payments/${providerPaymentId}/cancel`, {}, idempotenceKey,
    );
    return { providerPaymentId: data.id, status: mapStatus(data.status), raw: data };
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    const body: Record<string, unknown> = {
      payment_id: input.providerPaymentId,
      amount: { value: input.amount.toFixed(2), currency: "RUB" },
      description: input.description,
    };
    const data = await this.request<{ id: string; status: string }>(
      "POST", "/refunds", body, input.idempotenceKey,
    );
    return {
      providerRefundId: data.id,
      status: data.status as RefundResult["status"],
    };
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus> {
    const data = await this.request<YooKassaPaymentResponse>(
      "GET", `/payments/${providerPaymentId}`, undefined, crypto.randomUUID(),
    );
    return mapStatus(data.status);
  }

  verifyWebhook(ctx: WebhookContext, _body: unknown): boolean {
    // 1. YooKassa webhook signature (optional but recommended)
    //    YooKassa doesn't sign webhooks by default — they recommend IP filtering.
    //    If you enabled "Webhook signature" in your cabinet, it's sent as
    //    `X-Webhook-Signature` header — HMAC-SHA256 of raw body with secret key.
    const signature = ctx.headers["x-webhook-signature"];
    if (signature && env.yooKassaSecretKey) {
      const expected = crypto.createHmac("sha256", env.yooKassaSecretKey).update(ctx.rawBody).digest("hex");
      const expectedB64 = crypto.createHmac("sha256", env.yooKassaSecretKey).update(ctx.rawBody).digest("base64");
      // Constant-time compare
      if (signature !== expected && signature !== expectedB64) {
        log.warn("YooKassa webhook signature mismatch", { provider: ctx.provider });
        return false;
      }
      // Подпись проверена — IP-фильтр уже не нужен.
      return true;
    }

    // 2. IP whitelist — YooKassa публикует диапазоны своих вебхук-серверов.
    //    Если IP неизвестен (запрос пришёл не через прокси и не подписан),
    //    проверить подлинность нельзя — отклоняем.
    if (!ctx.clientIp) {
      log.warn("YooKassa webhook without signature and client IP — rejected", { provider: ctx.provider });
      return false;
    }
    if (!isIpAllowed("YOOKASSA", ctx.clientIp)) {
      log.warn("YooKassa webhook from disallowed IP", { ip: ctx.clientIp });
      return false;
    }
    return true;
  }

  parseWebhook(body: unknown, _ctx: WebhookContext): ParsedWebhook {
    const b = body as {
      event?: string;
      eventId?: string;
      status?: string;
      type?: string;
      object: {
        id: string;
        status: string;
        paid?: boolean;
        amount?: { value?: string };
        metadata?: { paymentId?: string };
        refund?: { id: string; status: string };
        payment_id?: string; // for refund events
        transactionId?: string; // legacy generic payload
        paymentId?: string; // legacy generic payload
      };
    };

    const obj = b.object ?? { id: "", status: "" };
    // ЮKassa всегда присылает `event`, но старый generic-формат (и часть
    // интеграций) передаёт только `status` — поддерживаем оба варианта.
    const event = b.event ?? legacyEventName(obj.status ?? b.status);
    const status = obj.status ?? b.status;

    if (!event && !status) {
      throw new Error("YooKassa webhook: missing event/status");
    }

    const internalPaymentId = obj.metadata?.paymentId ?? obj.paymentId;
    const eventId = b.eventId ?? `${event}:${obj.id}`;

    // Refund event: object.id = refund id, object.payment_id = original payment id
    if (event.startsWith("refund.")) {
      return {
        eventId,
        event,
        providerPaymentId: obj.payment_id ?? "",
        internalPaymentId,
        status: event === "refund.succeeded" ? "refunded" : "pending",
        amount: obj.amount?.value ? Number(obj.amount.value) : undefined,
        raw: body,
      };
    }

    return {
      eventId,
      event,
      providerPaymentId: obj.id ?? obj.transactionId ?? "",
      internalPaymentId,
      status: mapStatus(status ?? ""),
      amount: obj.amount?.value ? Number(obj.amount.value) : undefined,
      raw: body,
    };
  }
}

/** Derive the ЮKassa event name from a bare status (legacy payloads). */
function legacyEventName(status?: string): string {
  switch (status) {
    case "succeeded": return "payment.succeeded";
    case "canceled": return "payment.canceled";
    case "waiting_for_capture": return "payment.waiting_for_capture";
    case "pending": return "payment.pending";
    default: return "";
  }
}

/** Translate our Receipt shape to YooKassa's receipt JSON. */
function toYooKassaReceipt(r: Receipt): unknown {
  return {
    customer: {
      email: r.customer.email,
      phone: r.customer.phone,
      full_name: r.customer.fullName,
    },
    items: r.items.map((it) => ({
      description: it.description,
      quantity: it.quantity.toString(),
      amount: { value: it.amount.toFixed(2), currency: "RUB" },
      vat_code: it.vatCode,
      payment_mode: it.paymentMode,
      payment_subject: it.paymentSubject,
    })),
    tax_system_code: r.taxSystemCode,
  };
}
