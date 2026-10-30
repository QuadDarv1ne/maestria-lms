/**
 * CloudPayments provider.
 *
 * Documentation: https://developers.cloudpayments.ru/
 *
 * CloudPayments is a Russian acquiring aggregator that supports:
 *   - Bank cards (incl. МИР, Visa, Mastercard)
 *   - СБП (System of Fast Payments)
 *   - ЮMoney
 *   - SberPay
 *   - T-Pay
 *   - Apple Pay / Google Pay (mobile only)
 *
 * Auth: HTTP Basic with `publicId:apiSecret` base64-encoded.
 * Amounts in **kopecks**.
 *
 * Webhook: CloudPayments POSTs JSON to your NotificationURL.
 * Headers: `X-Content-HMAC` — HMAC-SHA256 of body with your apiSecret, base64.
 *
 * This implementation is mostly complete (createPayment, refund, status
 * check, webhook verification). Fill in remaining endpoints as needed.
 */

import crypto from "crypto";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import type {
  IPaymentProvider, ProviderName, PaymentMethod,
  CreatePaymentInput, PaymentResult, RefundInput, RefundResult,
  WebhookContext, ParsedWebhook, PaymentStatus,
} from "../types";

const API_URL = "https://api.cloudpayments.ru";

interface CPResponse<T> {
  Success: boolean;
  Message?: string;
  InnerMessage?: string;
  Model?: T;
}

export class CloudPaymentsProvider implements IPaymentProvider {
  readonly name: ProviderName = "CLOUDPAYMENTS";
  readonly label = "CloudPayments";
  readonly supportedMethods: readonly PaymentMethod[] = [
    "CARD", "SBP", "YOOMONEY", "SBERPAY", "TPAY",
  ];

  isConfigured(): boolean {
    return !!(env.cloudPaymentsPublicId && env.cloudPaymentsApiSecret);
  }

  private get authHeader(): string {
    const credentials = Buffer.from(`${env.cloudPaymentsPublicId}:${env.cloudPaymentsApiSecret}`).toString("base64");
    return `Basic ${credentials}`;
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new Error(`CloudPayments network error: ${err instanceof Error ? err.message : String(err)}`);
    }

    const data = (await res.json()) as CPResponse<T>;
    if (!data.Success) {
      log.error("CloudPayments API error", { path, message: data.Message });
      throw new Error(`CloudPayments: ${data.Message ?? "request failed"}`);
    }
    return data.Model as T;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    // CloudPayments: create a "cryptogram"-based payment for cards, OR a
    // "redirect"-based payment for SBP/e-wallets. For card-not-present
    // scenarios we use /orders/create — this returns a redirect URL.
    const body = {
      Amount: input.amount, // CloudPayments uses RUB with decimal
      Currency: "RUB",
      Description: input.description,
      InvoiceId: input.paymentId,
      // CloudPayments shows a method selector on their hosted page unless
      // you pass `PaymentMethod`:
      ...(input.method === "SBP" ? { PaymentMethod: "SBP" } : {}),
      ...(input.method === "YOOMONEY" ? { PaymentMethod: "YooMoney" } : {}),
      ...(input.method === "SBERPAY" ? { PaymentMethod: "Sberbank" } : {}),
      ...(input.method === "TPAY" ? { PaymentMethod: "TinkoffPay" } : {}),
      // CloudPayments can return a QR payload for SBP instead of a redirect:
      ...(input.method === "SBP" ? { Schema: "QR" } : {}),
      // Customer info for receipt:
      Email: input.customer.email,
      Phone: input.customer.phone,
      // 54-ФЗ receipt:
      ...(input.receipt ? { Receipt: toCloudPaymentsReceipt(input.receipt) } : {}),
      JsonData: { paymentId: input.paymentId, ...input.metadata },
    };

    const result = await this.request<{ Id: string; Url: string; QrUrl?: string }>(
      "/orders/create",
      body,
    );

    return {
      providerPaymentId: String(result.Id),
      status: "pending",
      confirmationUrl: result.Url,
      qrCode: result.QrUrl, // for SBP QR schema
      raw: result,
    };
  }

  async cancelPayment(providerPaymentId: string, _idempotenceKey: string): Promise<PaymentResult> {
    await this.request<{ Id: number }>("/orders/cancel", { Id: Number(providerPaymentId) });
    return { providerPaymentId, status: "failed" };
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    const result = await this.request<{ TransactionId: number; Status: string }>(
      "/payments/refund",
      {
        TransactionId: Number(input.providerPaymentId),
        Amount: input.amount,
      },
    );
    return {
      providerRefundId: String(result.TransactionId),
      status: result.Status === "Succeeded" ? "succeeded" : "pending",
    };
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus> {
    const result = await this.request<{ Status: string }>(
      "/payments/get",
      { TransactionId: Number(providerPaymentId) },
    );
    return mapCloudPaymentsStatus(result.Status);
  }

  verifyWebhook(ctx: WebhookContext, _body: unknown): boolean {
    // CloudPayments sends `X-Content-HMAC` header = HMAC-SHA256(rawBody, apiSecret) base64.
    const signature = ctx.headers["x-content-hmac"];
    if (!signature || !env.cloudPaymentsApiSecret) return false;

    const expected = crypto.createHmac("sha256", env.cloudPaymentsApiSecret)
      .update(ctx.rawBody)
      .digest("base64");

    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  parseWebhook(body: unknown, _ctx: WebhookContext): ParsedWebhook {
    const b = body as {
      TransactionId?: number;
      InvoiceId?: string; // = our internal paymentId
      Status?: string;
      EventType?: string; // e.g. "Pay", "Refund", "Confirm"
      Event?: string;
    };

    const eventType = b.EventType ?? b.Event ?? "";
    const isRefund = eventType.toLowerCase().includes("refund");

    return {
      eventId: `cp:${b.TransactionId ?? ""}:${eventType}`,
      event: isRefund ? "refund.succeeded" : `payment.${(b.Status ?? "").toLowerCase()}`,
      providerPaymentId: String(b.TransactionId ?? ""),
      internalPaymentId: b.InvoiceId,
      status: isRefund ? "refunded" : mapCloudPaymentsStatus(b.Status),
      raw: body,
    };
  }
}

function mapCloudPaymentsStatus(s?: string): PaymentStatus {
  switch (s?.toLowerCase()) {
    case "authorized":
    case "awaitingauthentication":
      return "pending";
    case "completed":
      return "completed";
    case "declined":
    case "cancelled":
      return "failed";
    case "refunded":
    case "partialrefund":
      return "refunded";
    default:
      return "pending";
  }
}

/** Translate our Receipt shape to CloudPayments' receipt JSON. */
function toCloudPaymentsReceipt(r: import("../types").Receipt): unknown {
  return {
    Items: r.items.map((it) => ({
      label: it.description,
      price: it.amount,
      quantity: it.quantity,
      amount: it.amount * it.quantity,
      vat: it.vatCode,
      method: it.paymentMode,
      object: it.paymentSubject,
    })),
    taxationSystem: r.taxSystemCode ?? 0,
    email: r.customer.email,
    phone: r.customer.phone,
  };
}
