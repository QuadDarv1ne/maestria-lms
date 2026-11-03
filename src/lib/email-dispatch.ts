import { sendEmail, type SendEmailOptions } from "./email";
import { enqueueEmail, type EmailPriority } from "./email-queue";
import { processEmailQueue } from "./email-worker";
import { log } from "./logger";

/**
 * Queue is "self-draining": after a job is enqueued we kick off a background
 * worker run in the same process. Amvera (our host) has no cron, so requiring
 * an external scheduler would leave mails unsent; the fire-and-forget kick
 * preserves the current delivery latency while still giving us the queue's
 * retries, priorities and dead-letter handling. An external cron hitting
 * POST /api/emails/process remains supported and is purely additive.
 */
let draining = false;

function kickWorker(): void {
  if (draining) return;
  draining = true;

  processEmailQueue({ batchSize: 10 })
    .catch((error: unknown) => {
      log.warn("Background email worker failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      draining = false;
    });
}

export interface DispatchEmailOptions extends SendEmailOptions {
  /** Delivery priority; "urgent" bypasses nothing but is sent first. */
  priority?: EmailPriority;
  /** Skip the queue and send inline (used where a boolean result is load-bearing). */
  direct?: boolean;
}

/**
 * Preferred entry point for transactional email.
 *
 * Returns whether the email was *accepted* (queued) or sent — not whether it
 * was delivered. Callers that must know delivery succeeded (e.g. the
 * verification-email flow logging a hard failure) should pass `direct: true`.
 */
export async function dispatchEmail(options: DispatchEmailOptions): Promise<boolean> {
  if (options.direct) {
    return sendEmail(options);
  }

  try {
    await enqueueEmail({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      priority: options.priority,
    });
    kickWorker();
    return true;
  } catch (error) {
    // Queue unavailable (no Redis) — fall back to the direct path so email
    // keeps working exactly as before on deployments without a cache.
    log.warn("Email queue unavailable, sending directly", {
      to: options.to,
      subject: options.subject,
      error: error instanceof Error ? error.message : String(error),
    });
    return sendEmail(options);
  }
}
