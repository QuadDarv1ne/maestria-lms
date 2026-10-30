/**
 * T-Bank (formerly Tinkoff) acquiring provider.
 *
 * Documentation: https://www.tbank.ru/business/help/internet-acquiring/api/
 *
 * Auth: every request carries `TerminalKey` + `Password` (both issued in the
 * merchant cabinet). Each request is signed by computing SHA-256 over the
 * sorted key=value pairs (excluding `DATA` and `Token`), appending `Password`,
 * and including the resulting hex as the `Token` field.
 *
 * Amounts are in **kopecks** (1 RUB = 100 kop).
 *
 * Supported methods:
 *   - CARD       — bank card (default Init flow, redirect to Tinkoff payment page)
 *   - SBP        — QR via Tinkoff SBP
 *   - TPAY       — T-Pay (opens T-Bank mobile app on customer's device)
 *
 * Webhooks: Tinkoff calls your `NOTIFY_URL` (set in cabinet per-terminal) with
 * a body containing `Token` field. Verify by recomputing the signature.
 */

import crypto from "crypto";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { isIpAllowed } from "../ip-whitelist";
import type {
  IPaymentProvider, ProviderName, PaymentMethod,
  CreatePaymentInput, PaymentResult, RefundInput, RefundResult,
  WebhookContext, ParsedWebhook, PaymentStatus,
} from "../types";

const API_URL = "https://securepay.tinkoff.ru/v2";

interface TinkoffResponse {
  Success: boolean;
  ErrorCode?: string;
  Message?: string;
  Details?: string;
  PaymentId?: string;
  PaymentURL?: string;
  OrderId?: string;
  Status?: string;
  Amount?: number;
}

export class TinkoffProvider implements IPaymentProvider {
  readonly name: ProviderName = "TINKOFF";
  readonly label = "Т-Банк (Tinkoff Kassa)";
  readonly supportedMethods: readonly PaymentMethod[] = ["CARD", "SBP", "TPAY"];

  isConfigured(): boolean {
    return !!(env.tinkoffTerminalKey && env.tinkoffPassword);
  }

  private get terminalKey(): string {
    const key = env.tinkoffTerminalKey;
    if (!key) throw new Error("TINKOFF_TERMINAL_KEY is not configured");
    return key;
  }

  private get password(): string {
    const password = env.tinkoffPassword;
    if (!password) throw new Error("TINKOFF_PASSWORD is not configured");
    return password;
  }

  /**
   * Compute Tinkoff's request signature.
   * Algorithm: take all top-level fields except `Token` and `DATA` (DATA is
   * a nested object — its values are signed by themselves via separate
   * checksum). Sort alphabetically by key, concatenate values, append the
   * password, SHA-256 the result.
   */
  private sign(payload: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(payload)) {
      if (key === "Token" || key === "DATA") continue;
      if (value === undefined || value === null) continue;
      parts.push(String(value));
    }
    parts.sort();
    parts.push(this.password);
    return crypto.createHash("sha256").update(parts.join("")).digest("hex");
  }

  private async request<T extends TinkoffResponse>(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    payload["TerminalKey"] = this.terminalKey;
    payload["Token"] = this.sign(payload);

    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw new Error(`Tinkoff network error: ${err instanceof Error ? err.message : String(err)}`);
    }

    const data = (await res.json()) as T;
    if (!data.Success) {
      log.error("Tinkoff API error", { path, code: data.ErrorCode, message: data.Message });
      throw new Error(`Tinkoff ${data.ErrorCode ?? "unknown"}: ${data.Message ?? "request failed"}`);
    }
    return data;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    // Tinkoff doesn't natively know about "method" — the choice between
    // card / SBP / T-Pay is made on their hosted payment page. For SBP and
    // T-Pay you can pre-select the method via the `PaymentType` field in the
    // DATA object — but the customer can still change it on the page unless
    // you also restrict in cabinet.
    const data: Record<string, unknown> = {
      Amount: Math.round(input.amount * 100), // kopecks
      OrderId: input.paymentId,
      Description: input.description,
      DATA: {
        paymentId: input.paymentId,
        // Hint Tinkoff which method to pre-select on the payment page:
        ...(input.method === "SBP" ? { PayType: "SBP" } : {}),
        ...(input.method === "TPAY" ? { PayType: "TinkoffPay" } : {}),
      },
      SuccessURL: input.returnUrl,
      FailURL: input.returnUrl + "?status=fail",
      NotificationURL: `${env.siteUrl}/api/payments/webhook?provider=TINKOFF`,
    };

    const resp = await this.request<TinkoffResponse>("/Init", data);

    if (!resp.PaymentId) {
      throw new Error(`Tinkoff /Init returned no PaymentId: ${resp.Message ?? "unknown error"}`);
    }

    return {
      providerPaymentId: resp.PaymentId,
      status: "pending",
      confirmationUrl: resp.PaymentURL,
      raw: resp,
    };
  }

  async cancelPayment(providerPaymentId: string, idempotenceKey: string): Promise<PaymentResult> {
    const resp = await this.request<TinkoffResponse>("/Cancel", {
      PaymentId: providerPaymentId,
      // Tinkoff doesn't use Idempotence-Key header — the same request is
      // safe to retry by design.
      Ip: idempotenceKey.slice(0, 39),
    });
    return {
      providerPaymentId,
      status: resp.Status === "CANCELLED" ? "failed" : "pending",
      raw: resp,
    };
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    const resp = await this.request<TinkoffResponse>("/Refund", {
      PaymentId: input.providerPaymentId,
      Amount: Math.round(input.amount * 100),
    });
    return {
      providerRefundId: resp.PaymentId ?? "",
      status: resp.Status === "REFUNDED" ? "succeeded" : "pending",
    };
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus> {
    const resp = await this.request<TinkoffResponse>("/GetState", { PaymentId: providerPaymentId });
    return mapTinkoffStatus(resp.Status);
  }

  verifyWebhook(ctx: WebhookContext, body: unknown): boolean {
    const b = body as Record<string, unknown>;
    const { Token, ...rest } = b;
    if (!Token || typeof Token !== "string") return false;
    const expected = this.sign(rest);
    if (Token.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(Token), Buffer.from(expected));
  }

  parseWebhook(body: unknown, _ctx: WebhookContext): ParsedWebhook {
    const b = body as {
      PaymentId?: string;
      OrderId?: string;
      Status?: string;
      Token?: string;
      OperationId?: string;
    };
    const status = mapTinkoffStatus(b.Status);
    return {
      eventId: `tinkoff:${b.OperationId ?? b.PaymentId ?? ""}:${b.Status ?? ""}`,
      event: `payment.${b.Status?.toLowerCase() ?? "unknown"}`,
      providerPaymentId: b.PaymentId ?? "",
      internalPaymentId: b.OrderId, // we set OrderId = our internal paymentId
      status,
      raw: body,
    };
  }
}

function mapTinkoffStatus(s?: string): PaymentStatus {
  switch (s) {
    case "NEW":
    case "FORM_SHOWED":
    case "AUTHORIZED":
    case "CHECKING":
      return "pending";
    case "CONFIRMED":
      return "completed";
    case "REVERSED":
    case "REJECTED":
      return "failed";
    case "REFUNDED":
    case "PARTIAL_REFUNDED":
      return "refunded";
    default:
      return "failed";
  }
}
