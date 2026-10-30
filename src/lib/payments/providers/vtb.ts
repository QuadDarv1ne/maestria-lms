/**
 * VTB Acquiring provider.
 *
 * VTB uses a white-labeled version of the Worldline / BPC acquiring platform.
 * API documentation is provided in your merchant cabinet after onboarding.
 *
 * Auth: merchant_id + secret_key (HMAC-signed requests).
 * Webhook: VTB POSTs JSON notifications to your configured webhook URL.
 *
 * This is a working stub. Fill in real API calls once you have VTB credentials.
 */

import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import type {
  IPaymentProvider, ProviderName, PaymentMethod,
  CreatePaymentInput, PaymentResult, RefundInput, RefundResult,
  WebhookContext, ParsedWebhook, PaymentStatus,
} from "../types";

export class VtbProvider implements IPaymentProvider {
  readonly name: ProviderName = "VTB";
  readonly label = "ВТБ Эквайринг";
  readonly supportedMethods: readonly PaymentMethod[] = ["CARD", "SBP"];

  isConfigured(): boolean {
    return !!(env.vtbMerchantId && env.vtbSecretKey);
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    throw new Error("VTB createPayment: not implemented — fill in once credentials are issued. " +
      `Order ${input.paymentId} for ${input.amount} RUB.`);
  }

  async cancelPayment(providerPaymentId: string, _idempotenceKey: string): Promise<PaymentResult> {
    throw new Error(`VTB cancelPayment: not implemented (${providerPaymentId})`);
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    throw new Error(`VTB refundPayment: not implemented (${input.providerPaymentId})`);
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus> {
    throw new Error(`VTB getPaymentStatus: not implemented (${providerPaymentId})`);
  }

  verifyWebhook(ctx: WebhookContext, _body: unknown): boolean {
    // ВТБ подписывает уведомления, но алгоритм доступен только после
    // подключения эквайринга. До этого момента отклоняем все вебхуки:
    // принимать их «как есть» означало бы позволить кому угодно
    // подтвердить оплату без денег.
    log.warn("VTB webhook rejected: verification not implemented yet", { provider: ctx.provider });
    return false;
  }

  parseWebhook(body: unknown, _ctx: WebhookContext): ParsedWebhook {
    const b = body as {
      transaction_id?: string;
      order_id?: string;
      status?: string;
      event_id?: string;
    };
    return {
      eventId: `vtb:${b.event_id ?? b.transaction_id ?? ""}`,
      event: "payment.notification",
      providerPaymentId: b.transaction_id ?? "",
      internalPaymentId: b.order_id,
      status: mapVtbStatus(b.status),
      raw: body,
    };
  }
}

function mapVtbStatus(s?: string): PaymentStatus {
  switch (s?.toLowerCase()) {
    case "new":
    case "pending":
    case "authorized":
      return "pending";
    case "success":
    case "completed":
    case "deposited":
      return "completed";
    case "declined":
    case "cancelled":
      return "failed";
    case "refunded":
    case "partial_refunded":
      return "refunded";
    default:
      return "pending";
  }
}
