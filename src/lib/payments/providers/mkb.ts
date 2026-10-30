/**
 * MKB (Moscow Credit Bank) acquiring provider.
 *
 * MKB uses a BPC Smart Vista-based platform. Documentation is provided in
 * your merchant cabinet after onboarding.
 *
 * This is a working stub — fill in real API calls once credentials are issued.
 */

import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import type {
  IPaymentProvider, ProviderName, PaymentMethod,
  CreatePaymentInput, PaymentResult, RefundInput, RefundResult,
  WebhookContext, ParsedWebhook, PaymentStatus,
} from "../types";

export class MkbProvider implements IPaymentProvider {
  readonly name: ProviderName = "MKB";
  readonly label = "МКБ Эквайринг";
  readonly supportedMethods: readonly PaymentMethod[] = ["CARD", "SBP"];

  isConfigured(): boolean {
    return !!(env.mkbMerchantId && env.mkbSecretKey);
  }

  async createPayment(_input: CreatePaymentInput): Promise<PaymentResult> {
    throw new Error("MKB createPayment: not implemented — fill in once credentials are issued.");
  }

  async cancelPayment(providerPaymentId: string, _idempotenceKey: string): Promise<PaymentResult> {
    throw new Error(`MKB cancelPayment: not implemented (${providerPaymentId})`);
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    throw new Error(`MKB refundPayment: not implemented (${input.providerPaymentId})`);
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus> {
    throw new Error(`MKB getPaymentStatus: not implemented (${providerPaymentId})`);
  }

  verifyWebhook(ctx: WebhookContext, _body: unknown): boolean {
    // МКБ подписывает уведомления, но алгоритм доступен только после
    // подключения эквайринга. До этого момента отклоняем все вебхуки.
    log.warn("MKB webhook rejected: verification not implemented yet", { provider: ctx.provider });
    return false;
  }

  parseWebhook(body: unknown, _ctx: WebhookContext): ParsedWebhook {
    const b = body as {
      payment_id?: string;
      order_id?: string;
      status?: string;
      event_id?: string;
    };
    return {
      eventId: `mkb:${b.event_id ?? b.payment_id ?? ""}`,
      event: "payment.notification",
      providerPaymentId: b.payment_id ?? "",
      internalPaymentId: b.order_id,
      status: mapMkbStatus(b.status),
      raw: body,
    };
  }
}

function mapMkbStatus(s?: string): PaymentStatus {
  switch (s?.toLowerCase()) {
    case "pending":
    case "authorized":
      return "pending";
    case "success":
    case "captured":
      return "completed";
    case "declined":
      return "failed";
    case "refunded":
      return "refunded";
    default:
      return "pending";
  }
}
