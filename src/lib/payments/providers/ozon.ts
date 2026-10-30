/**
 * Ozon Seller (Ozon Pay) provider.
 *
 * Documentation: https://docs.ozon.ru/api/seller/en/http/
 *
 * Ozon's payment API is part of the seller API. It supports:
 *   - Ozon Card (no commission for the customer)
 *   - Bank cards
 *   - СБП
 *   - Installment plans
 *
 * Auth: HTTP headers `Client-Id` + `Api-Key` (both issued in your Ozon Seller cabinet).
 *
 * Note: Ozon Pay is currently available only to Russian businesses registered
 * as Ozon sellers. If you don't have an Ozon shop, skip this provider.
 */

import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { isIpAllowed } from "../ip-whitelist";
import type {
  IPaymentProvider, ProviderName, PaymentMethod,
  CreatePaymentInput, PaymentResult, RefundInput, RefundResult,
  WebhookContext, ParsedWebhook, PaymentStatus,
} from "../types";

// Sandbox base URL differs from production — set via env OZON_API_URL.
const API_URL = () => env.ozonApiUrl ?? "https://api-seller.ozon.ru";

interface OzonResponse<T> {
  code?: number;
  message?: string;
  details?: unknown[];
  result?: T;
}

interface OzonPaymentResult {
  payment_id: string;
  payment_url?: string;
  status?: string;
  qr_code?: string;
}

export class OzonProvider implements IPaymentProvider {
  readonly name: ProviderName = "OZON";
  readonly label = "Ozon Pay";
  readonly supportedMethods: readonly PaymentMethod[] = ["CARD", "SBP", "OZON_CARD"];

  isConfigured(): boolean {
    return !!(env.ozonClientId && env.ozonApiKey);
  }

  private get headers(): Record<string, string> {
    const clientId = env.ozonClientId;
    const apiKey = env.ozonApiKey;
    if (!clientId || !apiKey) {
      throw new Error("Ozon Pay credentials are not configured (OZON_CLIENT_ID / OZON_API_KEY)");
    }
    return {
      "Client-Id": clientId,
      "Api-Key": apiKey,
      "Content-Type": "application/json",
    };
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    // Note: as of 2025, the Ozon Seller "create payment" endpoint is
    // `/v1/payment/create` (subject to change — check Ozon docs). The exact
    // request shape depends on which Ozon Pay product you've signed up for.
    //
    // This implementation targets the most common "Ozon Pay for digital
    // goods" flow. Adjust the body shape if your Ozon account uses a
    // different sub-product (e.g. instalment / subscription).
    const body = {
      amount: Math.round(input.amount * 100), // kopecks
      currency: "RUB",
      description: input.description,
      order_id: input.paymentId,
      // For SBP we ask Ozon to return a QR payload we can render ourselves.
      return_url: input.returnUrl,
      payment_method:
        input.method === "SBP" ? "sbp" :
        input.method === "OZON_CARD" ? "ozon_card" :
        "card",
      // Customer contact for receipt
      customer: input.customer.email ? { email: input.customer.email } : undefined,
      metadata: input.metadata,
    };

    let res: Response;
    try {
      res = await fetch(`${API_URL()}/v1/payment/create`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(`Ozon network error: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!res.ok) {
      const errText = await res.text();
      log.error("Ozon API error", { status: res.status, body: errText });
      throw new Error(`Ozon HTTP ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as OzonResponse<OzonPaymentResult>;
    if (!data.result) {
      throw new Error(`Ozon: ${data.message ?? "create payment failed"}`);
    }

    return {
      providerPaymentId: data.result.payment_id,
      status: "pending",
      confirmationUrl: data.result.payment_url,
      qrCode: data.result.qr_code,
      raw: data,
    };
  }

  async cancelPayment(providerPaymentId: string, _idempotenceKey: string): Promise<PaymentResult> {
    const res = await fetch(`${API_URL()}/v1/payment/cancel`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ payment_id: providerPaymentId }),
    });
    const data = (await res.json()) as OzonResponse<{ status: string }>;
    return {
      providerPaymentId,
      status: data.result?.status === "cancelled" ? "failed" : "pending",
      raw: data,
    };
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    const res = await fetch(`${API_URL()}/v1/payment/refund`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        payment_id: input.providerPaymentId,
        amount: Math.round(input.amount * 100),
        description: input.description,
      }),
    });
    const data = (await res.json()) as OzonResponse<{ refund_id: string; status: string }>;
    return {
      providerRefundId: data.result?.refund_id ?? "",
      status: (data.result?.status ?? "pending") as RefundResult["status"],
    };
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus> {
    const res = await fetch(`${API_URL()}/v1/payment/info`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ payment_id: providerPaymentId }),
    });
    const data = (await res.json()) as OzonResponse<{ status: string }>;
    return mapOzonStatus(data.result?.status);
  }

  verifyWebhook(ctx: WebhookContext, _body: unknown): boolean {
    // Ozon signs webhooks with HMAC-SHA256 using a per-webhook secret
    // configured in your seller cabinet. Header name: `X-Ozon-Signature`.
    // The signature is base64 of the HMAC over the raw body.
    const signature = ctx.headers["x-ozon-signature"];
    const secret = env.ozonWebhookSecret;

    // Without a webhook secret we cannot authenticate the request at all —
    // reject rather than fall through to an (likely empty) IP whitelist.
    if (!secret) {
      log.warn("Ozon webhook rejected: OZON_WEBHOOK_SECRET is not configured");
      return false;
    }

    if (signature) {
      const expected = cryptoB64Hmac(secret, ctx.rawBody);
      if (signature.length !== expected.length || signature !== expected) {
        log.warn("Ozon webhook signature mismatch", { provider: ctx.provider });
        return false;
      }
      // Signature verified — IP check is optional.
      return true;
    }

    // No signature header but secret is configured — try IP whitelist.
    if (!isIpAllowed("OZON", ctx.clientIp)) {
      log.warn("Ozon webhook from disallowed IP", { ip: ctx.clientIp });
      return false;
    }
    return true;
  }

  parseWebhook(body: unknown, _ctx: WebhookContext): ParsedWebhook {
    const b = body as {
      event?: string;
      payment_id?: string;
      order_id?: string;
      status?: string;
      webhook_id?: string;
    };
    const status = mapOzonStatus(b.status);
    return {
      eventId: `ozon:${b.webhook_id ?? b.payment_id ?? ""}:${b.event ?? b.status ?? ""}`,
      event: b.event ?? `payment.${b.status?.toLowerCase() ?? "unknown"}`,
      providerPaymentId: b.payment_id ?? "",
      internalPaymentId: b.order_id,
      status,
      raw: body,
    };
  }
}

function mapOzonStatus(s?: string): PaymentStatus {
  switch (s?.toLowerCase()) {
    case "created":
    case "pending":
    case "processing":
      return "pending";
    case "approved":
    case "captured":
    case "succeeded":
      return "completed";
    case "rejected":
    case "canceled":
    case "failed":
      return "failed";
    case "refunded":
    case "partially_refunded":
      return "refunded";
    default:
      return "failed";
  }
}

import crypto from "crypto";
function cryptoB64Hmac(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("base64");
}
