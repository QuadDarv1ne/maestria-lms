/**
 * Payment provider abstraction layer.
 *
 * This module defines a unified interface (`IPaymentProvider`) implemented by
 * every gateway (YooKassa, Tinkoff, Ozon, Sberbank, VTB, MKB, CloudPayments).
 * The application talks to providers only through this interface — never
 * directly to a specific gateway API. Adding a new provider = adding a new
 * file under `providers/` and registering it in `registry.ts`.
 */

/** Internal provider identifier stored in `Payment.provider`. */
export type ProviderName =
  | "YOOKASSA"
  | "TINKOFF"
  | "CLOUDPAYMENTS"
  | "SBER"
  | "OZON"
  | "VTB"
  | "MKB";

/**
 * Payment method — what the *customer* sees as the payment option.
 * A single provider typically supports several methods
 * (e.g. YooKassa supports CARD, SBP, YOOMONEY, SBERPAY, TPAY, YANDEX_PAY).
 */
export type PaymentMethod =
  | "CARD"
  | "SBP"
  | "YOOMONEY"
  | "SBERPAY"
  | "TPAY"
  | "YANDEX_PAY"
  | "OZON_CARD"
  | "WALLET";

/** Internal Payment.status — kept compatible with existing string column. */
export type PaymentStatus =
  | "pending"
  | "completed"
  | "failed"
  | "refunded";

/** 54-ФЗ receipt item — sent to provider so they can register fiscal cheque. */
export interface ReceiptItem {
  description: string;
  amount: number; // RUB, including any discount allocation
  quantity: number;
  vatCode: 1 | 2 | 3 | 4 | 5 | 6; // 1 = НДС 20%, see YooKassa docs
  paymentMode: "full_payment" | "partial_prepayment" | "advance";
  paymentSubject:
    | "commodity"
    | "excise"
    | "job"
    | "service" // online course → service
    | "gambling_bet"
    | "gambling_prize"
    | "lottery"
    | "intellectual_activity" // also valid for educational content
    | "payment"
    | "agent_commission"
    | "composite"
    | "another";
}

export interface Receipt {
  customer: {
    email?: string;
    phone?: string;
    fullName?: string;
  };
  items: ReceiptItem[];
  taxSystemCode?: 1 | 2 | 3 | 4 | 5 | 6; // 1 = общая СН, see YooKassa docs
}

export interface CreatePaymentInput {
  /** Internal payment id (Payment.id in DB). */
  paymentId: string;
  /** Idempotency key — same key + same payload = same payment on provider side. */
  idempotenceKey: string;
  amount: number; // RUB
  currency: "RUB";
  description: string;
  returnUrl: string;
  method: PaymentMethod;
  receipt?: Receipt;
  customer: { email?: string; phone?: string; fullName?: string };
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  /** Provider-side payment id (e.g. YooKassa `24b9c9b4-000f-5000-9000-1e2c3a4b5c6d`). */
  providerPaymentId: string;
  status: PaymentStatus;
  /** For redirect flow (cards, e-wallets). */
  confirmationUrl?: string;
  /** For QR flow (СБП). Payload string the QR encoder renders. */
  qrCode?: string;
  paidAt?: Date;
  raw?: unknown;
}

export interface CaptureInput {
  providerPaymentId: string;
  amount: number;
  idempotenceKey: string;
}

export interface RefundInput {
  providerPaymentId: string;
  amount: number;
  idempotenceKey: string;
  description?: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: "succeeded" | "pending" | "canceled" | "failed";
}

export interface WebhookContext {
  /** Raw request body — verify signature against this. */
  rawBody: string;
  /** All request headers, lower-cased. */
  headers: Record<string, string>;
  /** Client IP from x-forwarded-for or remoteAddress. */
  clientIp?: string;
  /** Provider name resolved from URL path or header. */
  provider: ProviderName;
}

export interface ParsedWebhook {
  /** Globally unique event id from provider (used for idempotency). */
  eventId: string;
  event: string; // e.g. "payment.succeeded", "refund.succeeded"
  /** Provider-side payment id (NOT our internal Payment.id). */
  providerPaymentId: string;
  /** Our internal Payment.id — taken from provider `metadata` field. */
  internalPaymentId?: string;
  status: PaymentStatus;
  amount?: number;
  raw: unknown;
}

/**
 * Every provider must implement this interface.
 * Methods are async and may throw on network/HTTP errors — caller must catch.
 */
export interface IPaymentProvider {
  readonly name: ProviderName;
  readonly supportedMethods: readonly PaymentMethod[];
  /** Human-readable label for admin UI. */
  readonly label: string;

  isConfigured(): boolean;

  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;

  /** Confirm a 2-step payment (capture=false during create). Optional. */
  capturePayment?(input: CaptureInput): Promise<PaymentResult>;

  /** Cancel a pending payment. */
  cancelPayment(providerPaymentId: string, idempotenceKey: string): Promise<PaymentResult>;

  /** Full or partial refund of a captured payment. */
  refundPayment(input: RefundInput): Promise<RefundResult>;

  /** Get current payment status from provider (for reconciliation cron). */
  getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus>;

  /** Verify webhook authenticity (signature + IP whitelist). */
  verifyWebhook(ctx: WebhookContext, body: unknown): boolean;

  /** Parse provider-specific webhook body into normalized event. */
  parseWebhook(body: unknown, ctx: WebhookContext): ParsedWebhook;
}
