import { log } from "./logger";
import {
  getQueueStats,
  dequeueEmail,
  completeEmail,
  failEmail,
  promoteDueRetries,
  collectOrphanedJobs,
  type QueueStats,
} from "./email-queue";
import { sendEmail } from "./email";

export interface EmailWorkerConfig {
  /** Maximum emails to process in a single run (batch size). */
  batchSize?: number;
  /** Enable maintenance pass (orphan cleanup + retry promotion). */
  maintenance?: boolean;
}

export interface EmailWorkerResult {
  processed: number;
  succeeded: number;
  failed: number;
  /** Jobs promoted from retry → queue (backoff elapsed). */
  promoted: number;
  /** Jobs cleaned up (stale or payload-missing). */
  cleaned: number;
  durationMs: number;
  queueStats: QueueStats;
}

/**
 * Process email jobs from the queue.
 *
 * Each invocation:
 * 1. Runs maintenance (orphan cleanup + retry promotion) — fast, non-blocking.
 * 2. Dequeues and sends up to `batchSize` jobs.
 *
 * Designed to be called from a cron endpoint; in production a separate worker
 * process or external scheduler (Amvera) may invoke it.
 */
export async function processEmailQueue(config: EmailWorkerConfig = {}): Promise<EmailWorkerResult> {
  const { batchSize = 10, maintenance = true } = config;
  const startMs = Date.now();

  let promoted = 0;
  let cleaned = 0;

  // ── Maintenance pass ──────────────────────────────────────────────
  if (maintenance) {
    const [c, p] = await Promise.allSettled([
      collectOrphanedJobs(),
      promoteDueRetries(),
    ]);
    if (c.status === "fulfilled") cleaned = c.value;
    if (p.status === "fulfilled") promoted = p.value;
  }

  // ── Delivery pass ─────────────────────────────────────────────────
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < batchSize; i++) {
    const job = await dequeueEmail();
    if (!job) break; // queue drained

    processed += 1;

    try {
      const sent = await sendEmail({
        to: job.to,
        subject: job.subject,
        html: job.html,
        text: job.text,
      });

      if (sent) {
        await completeEmail(job.id);
        succeeded += 1;
        log.info("Email sent from queue", { jobId: job.id, to: job.to, priority: job.priority });
      } else {
        // sendEmail returns false only when RESEND_API_KEY is not configured.
        // This is a fatal condition — don't retry.
        await failEmail(job.id, "RESEND_API_KEY not configured");
        failed += 1;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await failEmail(job.id, errorMsg);
      failed += 1;
    }
  }

  const durationMs = Date.now() - startMs;
  const queueStats = await getQueueStats();

  const result: EmailWorkerResult = {
    processed,
    succeeded,
    failed,
    promoted,
    cleaned,
    durationMs,
    queueStats,
  };

  if (processed > 0 || promoted > 0) {
    log.info("Email worker run completed", result);
  }

  return result;
}
