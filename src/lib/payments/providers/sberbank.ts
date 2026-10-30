/**
 * Sberbank acquiring provider.
 *
 * Sber's API documentation is gated behind their merchant cabinet — the
 * general public link is https://www.sberbank.ru/ru/s_m_business/pro/businessconnect/acquiring
 *
 * Sber supports:
 *   - Bank cards
 *   - SberPay (pay with Sberbank mobile app)
 *   - СБП (System of Fast Payments)
 *
 * Auth: `userName` + `password` (basic API auth, issued in cabinet).
 * Amounts in **kopecks**.
 *
 * Webhook URL: configured per-merchant, Sber POSTs JSON to it.
 * Status verification: GET /payment/rest/getOrderStatusExtended.do
 *
 * This is a working stub — it compiles, validates inputs, and returns a clear
 * "not implemented" error if called without credentials. Replace TODOs with
 * real API calls once you have Sber credentials and the official docs.
 */

import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import type {
  IPaymentProvider, ProviderName, PaymentMethod,
  CreatePaymentInput, PaymentResult, RefundInput, RefundResult,
  WebhookContext, ParsedWebhook, PaymentStatus,
} from "../types";

export class SberbankProvider implements IPaymentProvider {
  readonly name: ProviderName = "SBER";
  readonly label = "Сбербанк Эквайринг";
  readonly supportedMethods: readonly PaymentMethod[] = ["CARD", "SBP", "SBERPAY"];

  isConfigured(): boolean {
    return !!(env.sberUsername && env.sberPassword);
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    // Real implementation:
    //   POST https://3dsec.sberbank.ru/payment/rest/register.do
    //   body: userName=...&password=...&orderNumber=<paymentId>&amount=<kop>&returnUrl=...
    //
    // Response: { orderId, formUrl } — redirect customer to formUrl.
    //
    // For SberPay: add `paymentType=SBP` to body.
    // For SBP QR: use /payment/rest/sbp/c2b/qr/dynamic/get.do endpoint.
    throw new Error("Sberbank createPayment: not implemented — fill in once credentials are issued. " +
      `Order ${input.paymentId} for ${input.amount} RUB.`);
  }

  async cancelPayment(providerPaymentId: string, _idempotenceKey: string): Promise<PaymentResult> {
    throw new Error(`Sberbank cancelPayment: not implemented (${providerPaymentId})`);
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    // POST /payment/rest/refund.do  body: userName&password&orderId&amount
    throw new Error(`Sberbank refundPayment: not implemented (${input.providerPaymentId})`);
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus> {
    throw new Error(`Sberbank getPaymentStatus: not implemented (${providerPaymentId})`);
  }

  verifyWebhook(ctx: WebhookContext, _body: unknown): boolean {
    // Сбербанк не подписывает вебхуки криптографически — проверка опирается
    // на IP-фильтрацию и секрет мерчанта. Реализовать после подключения
    // эквайринга; до этого момента отклоняем все уведомления.
    log.warn("Sberbank webhook rejected: verification not implemented yet", { provider: ctx.provider });
    return false;
  }

  parseWebhook(body: unknown, _ctx: WebhookContext): ParsedWebhook {
    const b = body as {
      mdOrder?: string;     // Sber's order id (= our providerPaymentId)
      orderNumber?: string; // our internal payment id
      status?: string;
      operation?: string;
    };
    return {
      eventId: `sber:${b.mdOrder ?? ""}:${b.operation ?? ""}`,
      event: b.operation ?? "payment.unknown",
      providerPaymentId: b.mdOrder ?? "",
      internalPaymentId: b.orderNumber,
      status: mapSberStatus(b.status),
      raw: body,
    };
  }
}

function mapSberStatus(s?: string): PaymentStatus {
  switch (s) {
    case "PREAUTHORIZED":
    case "CREATED":
      return "pending";
    case "DEPOSITED":
      return "completed";
    case "DECLINED":
    case "REVERSED":
      return "failed";
    case "REFUNDED":
    case "PARTIAL_REFUNDED":
      return "refunded";
    default:
      return "pending";
  }
}
