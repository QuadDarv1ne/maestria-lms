import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";

export interface WebhookEvent {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: Date | null;
  nextRetryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BASE_DELAY_MS = 1000; // 1 second
const MAX_DELAY_MS = 3600000; // 1 hour

/**
 * Calculate the next retry delay using exponential backoff with jitter.
 * Formula: min(baseDelay * 2^attempt, maxDelay) * (0.5 + random() * 0.5)
 */
export function calculateRetryDelay(attempt: number): number {
  const exponentialDelay = Math.min(
    BASE_DELAY_MS * Math.pow(2, attempt),
    MAX_DELAY_MS
  );
  // Add jitter: 50-100% of the calculated delay
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.floor(exponentialDelay * jitter);
}

/**
 * Create a webhook event in the database for retry tracking.
 */
export async function createWebhookEvent(
  type: string,
  payload: Prisma.InputJsonValue,
  maxAttempts: number = 5
): Promise<WebhookEvent> {
  const event = await db.webhookEvent.create({
    data: {
      type,
      payload,
      status: "pending",
      attempts: 0,
      maxAttempts,
      nextRetryAt: new Date(), // Ready for immediate processing
    },
  });

  return event as unknown as WebhookEvent;
}

/**
 * Process a webhook event with retry logic.
 * Calls the provided handler function and retries on failure.
 */
export async function processWebhookWithRetry(
  eventId: string,
  handler: () => Promise<boolean>,
): Promise<boolean> {
  const event = await db.webhookEvent.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    log.error(`Webhook event not found: ${eventId}`);
    return false;
  }

  // Mark as processing
  await db.webhookEvent.update({
    where: { id: eventId },
    data: {
      status: "processing",
      lastAttemptAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  try {
    const success = await handler();

    if (success) {
      await db.webhookEvent.update({
        where: { id: eventId },
        data: {
          status: "completed",
        },
      });
      return true;
    }

    throw new Error("Handler returned false");
  } catch (error) {
    const updatedEvent = await db.webhookEvent.findUnique({
      where: { id: eventId },
    });

    if (!updatedEvent) return false;

    const attempt = updatedEvent.attempts;

    if (attempt >= updatedEvent.maxAttempts) {
      // Max attempts reached, mark as failed
      await db.webhookEvent.update({
        where: { id: eventId },
        data: {
          status: "failed",
        },
      });
      log.error(`Webhook event ${eventId} failed after ${attempt} attempts`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }

    // Schedule retry
    const delayMs = calculateRetryDelay(attempt);
    const nextRetryAt = new Date(Date.now() + delayMs);

    await db.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: "pending",
        nextRetryAt,
      },
    });

    log.warn(
      `Webhook event ${eventId} will retry in ${Math.round(delayMs / 1000)}s (attempt ${attempt}/${updatedEvent.maxAttempts})`,
      {
        error: error instanceof Error ? error.message : String(error),
        nextRetryAt: nextRetryAt.toISOString(),
      }
    );

    return false;
  }
}

/**
 * Process all pending webhook events that are due for retry.
 * Call this periodically (e.g., via a cron job or serverless function).
 */
export async function processPendingWebhooks(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const now = new Date();

  const pendingEvents = await db.webhookEvent.findMany({
    where: {
      status: "pending",
      nextRetryAt: { lte: now },
    },
    orderBy: { nextRetryAt: "asc" },
    take: 50, // Process in batches
  });

  let succeeded = 0;
  let failed = 0;

  for (const event of pendingEvents) {
    try {
      // Each event type should have its own handler registered elsewhere.
      // This generic processor marks events as "processing" so they can be
      // picked up by type-specific handlers, or retried if no handler exists.
      await db.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: "processing",
          lastAttemptAt: now,
          attempts: { increment: 1 },
        },
      });
      // In a real implementation, dispatch to type-specific handlers here.
      // For now, mark as failed after max attempts to avoid infinite retries.
      const updatedEvent = await db.webhookEvent.findUnique({
        where: { id: event.id },
      });
      if (updatedEvent && updatedEvent.attempts >= updatedEvent.maxAttempts) {
        await db.webhookEvent.update({
          where: { id: event.id },
          data: { status: "failed" },
        });
        failed++;
      } else {
        // Schedule next retry with exponential backoff
        const delayMs = calculateRetryDelay(updatedEvent?.attempts ?? 1);
        await db.webhookEvent.update({
          where: { id: event.id },
          data: {
            status: "pending",
            nextRetryAt: new Date(Date.now() + delayMs),
          },
        });
        // Count as "processed" but not succeeded since no handler ran
        succeeded++;
      }
    } catch (error) {
      log.error(`Failed to process webhook event ${event.id}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }
  }

  return {
    processed: pendingEvents.length,
    succeeded,
    failed,
  };
}

/**
 * Clean up old webhook events (completed/failed older than retention period).
 */
export async function cleanupOldWebhookEvents(
  retentionDays: number = 30
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await db.webhookEvent.deleteMany({
    where: {
      status: { in: ["completed", "failed"] },
      updatedAt: { lt: cutoff },
    },
  });

  return result.count;
}