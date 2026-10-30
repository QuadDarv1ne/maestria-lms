-- Migration: payments_multigateway
--
-- Adds support for multiple payment providers (YooKassa, Tinkoff, Ozon,
-- Sberbank, VTB, MKB, CloudPayments). The existing Payment table is kept
-- backward-compatible — `paymentMethod` continues to accept legacy values
-- (sbp/yookassa/tinkoff/card) and now also accepts new method names
-- (card/sbp/yoomoney/sberpay/tpay/yandex_pay/ozon_card/wallet).
--
-- New `paymentProvider` column stores the gateway name (YOOKASSA/TINKOFF/...).
-- New `PaymentWebhookEvent` table enables idempotent webhook processing.

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Unique constraint on eventId — this is the at-most-once guarantee.
CREATE UNIQUE INDEX "PaymentWebhookEvent_eventId_key" ON "PaymentWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_paymentId_idx" ON "PaymentWebhookEvent"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_provider_event_idx" ON "PaymentWebhookEvent"("provider", "event");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_processedAt_idx" ON "PaymentWebhookEvent"("processedAt");

-- CreateIndex
-- Composite index for filtering by (provider, status) — useful for admin
-- analytics and provider reconciliation jobs.
CREATE INDEX "Payment_paymentProvider_status_idx" ON "Payment"("paymentProvider", "status");

-- AddForeignKey
-- SET NULL on delete: keep webhook history even after the payment row is purged.
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
