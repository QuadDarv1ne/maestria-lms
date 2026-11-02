/**
 * Batch reconciliation of stale pending payments.
 *
 * A webhook is the primary source of truth, and `syncPaymentWithProvider()`
 * already repairs a payment when its owner opens the payment page. This module
 * covers the remaining case: the user closed the tab (or never returned from
 * the provider) and the webhook was lost. Such a payment stays "pending"
 * forever, so the money is taken but access is never granted.
 *
 * The reconciler is meant to be called periodically by an external scheduler
 * (see POST /api/payments/reconcile). It is safe to run concurrently: the
 * actual completion still goes through the idempotent `completePayment()`,
 * and purchase notifications are sent only by the call that completed the
 * payment (`alreadyCompleted === false`).
 */

import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { notifyPaymentCompleted, syncPaymentWithProvider } from "./service";

export interface ReconcileOptions {
  /** Only payments older than this are checked (default 15 minutes). */
  minAgeMinutes?: number;
  /** Ignore payments older than this — abandoned checkouts (default 30 days). */
  maxAgeDays?: number;
  /** Max payments per run (default 50, hard cap 200). */
  batchSize?: number;
  /** Injectable clock for tests. */
  now?: Date;
}

export interface ReconcileSummary {
  /** Payments selected for this run. */
  scanned: number;
  /** Provider confirmed payment and access was granted by this run. */
  completed: number;
  /** Provider reported a terminal failure. */
  failed: number;
  /** Provider still reports pending (or the answer was inconclusive). */
  pending: number;
  /** Could not be checked (no provider id, unknown/unconfigured provider). */
  skipped: number;
  /** Provider call failed — will be retried on the next run. */
  unknown: number;
  /** Unexpected errors while processing an individual payment. */
  errors: number;
  durationMs: number;
}

const DEFAULT_MIN_AGE_MINUTES = 15;
const DEFAULT_MAX_AGE_DAYS = 30;
const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 200;

function clampInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

async function notifyCompleted(payment: {
  id: string;
  userId: string;
  courseId: string;
}): Promise<void> {
  const [course, user] = await Promise.all([
    db.course.findUnique({ where: { id: payment.courseId }, select: { title: true } }),
    db.user.findUnique({ where: { id: payment.userId }, select: { email: true, name: true } }),
  ]);
  if (!course || !user) {
    log.warn("Payment reconcile: cannot notify, course or user missing", {
      paymentId: payment.id,
      courseId: payment.courseId,
      userId: payment.userId,
    });
    return;
  }
  notifyPaymentCompleted(payment, course.title, user.name, user.email);
}

/**
 * Find pending payments that have a real provider id and ask the provider for
 * their current status. Returns an aggregate summary suitable for a cron log.
 *
 * Errors are isolated per payment: one broken gateway response must not stop
 * the rest of the batch.
 */
export async function reconcilePendingPayments(
  options: ReconcileOptions = {},
): Promise<ReconcileSummary> {
  const startedAt = Date.now();
  const now = options.now ?? new Date();
  const minAgeMinutes = clampInteger(options.minAgeMinutes, DEFAULT_MIN_AGE_MINUTES, 0, 24 * 60);
  const maxAgeDays = clampInteger(options.maxAgeDays, DEFAULT_MAX_AGE_DAYS, 1, 365);
  const batchSize = clampInteger(options.batchSize, DEFAULT_BATCH_SIZE, 1, MAX_BATCH_SIZE);

  const createdBefore = new Date(now.getTime() - minAgeMinutes * 60_000);
  const createdAfter = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60_000);

  const rows = await db.payment.findMany({
    where: {
      status: "pending",
      createdAt: { gte: createdAfter, lte: createdBefore },
      // Placeholder ids written at creation (pending_<uuid>) and by the
      // test-mode route (sim_<timestamp>) identify no provider object.
      NOT: [
        { transactionId: null },
        { transactionId: { startsWith: "pending_" } },
        { transactionId: { startsWith: "sim_" } },
      ],
      paymentProvider: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: { id: true },
  });

  const summary: ReconcileSummary = {
    scanned: rows.length,
    completed: 0,
    failed: 0,
    pending: 0,
    skipped: 0,
    unknown: 0,
    errors: 0,
    durationMs: 0,
  };

  for (const row of rows) {
    try {
      const outcome = await syncPaymentWithProvider(row.id);

      switch (outcome.status) {
        case "completed":
          summary.completed += 1;
          // A concurrent webhook (or the payment page) may have completed the
          // payment first; only the winner sends the notification.
          if (!outcome.alreadyCompleted && outcome.payment) {
            await notifyCompleted(outcome.payment);
          }
          break;
        case "failed":
          summary.failed += 1;
          break;
        case "pending":
          summary.pending += 1;
          break;
        case "unknown":
          summary.unknown += 1;
          break;
        case "skipped":
        default:
          summary.skipped += 1;
          break;
      }
    } catch (err) {
      summary.errors += 1;
      log.error("Payment reconcile: failed to process payment", {
        paymentId: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  summary.durationMs = Date.now() - startedAt;
  log.info("Payment reconcile finished", { ...summary, minAgeMinutes, maxAgeDays, batchSize });
  return summary;
}
