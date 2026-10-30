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

-- 1. Existing Payment table is extended in-place (no column renames).
--    Add a composite index for filtering by (provider, status) — useful for
--    admin analytics and provider reconciliation jobs.

CREATE INDEX IF NOT EXISTS "Payment_paymentProvider_status_idx"
  ON "Payment" ("paymentProvider", "status");

-- 2. New table for webhook event log + idempotency guarantee.

CREATE TABLE IF NOT EXISTS "PaymentWebhookEvent" (
    "id"          TEXT     NOT NULL,
    "paymentId"   TEXT,
    "provider"    TEXT     NOT NULL,
    "eventId"     TEXT     NOT NULL,
    "event"       TEXT     NOT NULL,
    "payload"     TEXT     NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on eventId — this is the at-most-once guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentWebhookEvent_eventId_key"
  ON "PaymentWebhookEvent" ("eventId");

CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_paymentId_idx"
  ON "PaymentWebhookEvent" ("paymentId");

CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_provider_event_idx"
  ON "PaymentWebhookEvent" ("provider", "event");

CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_processedAt_idx"
  ON "PaymentWebhookEvent" ("processedAt");

-- Foreign key to Payment (with SET NULL on delete, since we still want to
-- keep webhook history even after the payment row is purged).
-- Note: SQLite supports FK only when PRAGMA foreign_keys=ON; Prisma enables
-- this automatically. For PostgreSQL this is unconditional.

-- PostgreSQL variant (Prisma uses this on `prisma migrate deploy`):
-- ALTER TABLE "PaymentWebhookEvent"
--   ADD CONSTRAINT "PaymentWebhookEvent_paymentId_fkey"
--   FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
--   ON DELETE SET NULL ON UPDATE CASCADE;
