import { log } from "./logger";
import { getRedisClient } from "./redis";

// ==================== TYPES ====================

export type EmailPriority = "low" | "normal" | "high" | "urgent";

export interface EmailJob {
  id: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  priority: EmailPriority;
  retries: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt?: string;
  error?: string;
}

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  priority?: EmailPriority;
  maxRetries?: number;
}

export interface QueueStats {
  pending: number;
  /** Jobs waiting out a retry backoff window (not yet eligible for sending). */
  delayed: number;
  processing: number;
  completed: number;
  dead: number;
  byPriority: Record<EmailPriority, number>;
}

// ==================== CONSTANTS ====================

const QUEUE_KEY = "email:queue";
const RETRY_KEY = "email:retry";
const PROCESSING_KEY = "email:processing";
const COMPLETED_KEY = "email:completed";
const DEAD_KEY = "email:dead";
const JOB_KEY_PREFIX = "email:job:";

/**
 * Priority occupies the leading digit of the score, timestamp the trailing 13.
 * Score = priority * 1e13 + timestamp keeps ordering exact as a float64
 * (max ≈ 3.2e13, far below 2^53 ≈ 9e15 where integers stay exact). A
 * "priority.timestamp" string would silently round at 14 significant digits.
 */
const TIMESTAMP_MULTIPLIER = 1e13;

const PRIORITY_SCORES: Record<EmailPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const MAX_RETRIES_DEFAULT = 5;
/** Backoff between attempts; the last value repeats once maxRetries exceeds it. */
export const RETRY_DELAYS_MS = [60_000, 300_000, 900_000, 2_700_000, 5_400_000];

/** Finished/abandoned job payloads are dropped after this to bound memory. */
const JOB_TTL_SECONDS = 7 * 24 * 60 * 60;
/** In-flight jobs without a completion signal are collected after this. */
const PROCESSING_TTL_MS = 15 * 60 * 1000;
const COMPLETED_KEEP = 1000;

// ==================== HELPERS ====================

function generateId(): string {
  return `email_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function queueScore(priority: EmailPriority, timestamp: number): number {
  return PRIORITY_SCORES[priority] * TIMESTAMP_MULTIPLIER + timestamp;
}

function jobKey(jobId: string): string {
  return `${JOB_KEY_PREFIX}${jobId}`;
}

// ==================== QUEUE OPERATIONS ====================

/**
 * Add an email job to the queue. Jobs are popped in priority order; jobs of
 * equal priority are processed oldest-first (FIFO within a priority band).
 */
export async function enqueueEmail(data: EmailJobData): Promise<EmailJob> {
  const redis = getRedisClient();
  if (!redis) {
    // Caller decides how to degrade — see dispatchEmail() for the fallback.
    throw new Error("Redis not available — email queue is offline");
  }

  const now = Date.now();
  const job: EmailJob = {
    id: generateId(),
    to: data.to,
    subject: data.subject,
    html: data.html,
    text: data.text,
    priority: data.priority ?? "normal",
    retries: 0,
    maxRetries: data.maxRetries ?? MAX_RETRIES_DEFAULT,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };

  await redis
    .multi()
    .set(jobKey(job.id), JSON.stringify(job))
    .zadd(QUEUE_KEY, queueScore(job.priority, now), job.id)
    .exec();

  log.info("Email queued", {
    jobId: job.id,
    to: job.to,
    subject: job.subject,
    priority: job.priority,
  });

  return job;
}

/**
 * Move retry jobs whose backoff window has elapsed back into the main queue,
 * re-scored by priority. Runs before every dequeue so a single worker call
 * both promotes and sends.
 */
export async function promoteDueRetries(): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  const due = await redis.zrangebyscore(RETRY_KEY, "-inf", Date.now(), "LIMIT", 0, 50);
  if (due.length === 0) return 0;

  const payloads = await redis.mget(due.map(jobKey));
  const multi = redis.multi();
  let promoted = 0;

  due.forEach((jobId, i) => {
    multi.zrem(RETRY_KEY, jobId);

    const raw = payloads[i];
    if (!raw) return;
    try {
      const job: EmailJob = JSON.parse(raw);
      // Promotion time (not the original enqueue time) is used so a promoted
      // job competes fairly with jobs enqueued while it was backing off.
      multi.zadd(QUEUE_KEY, queueScore(job.priority, Date.now()), jobId);
      promoted += 1;
    } catch {
      // Malformed payload: leave it out of the queue, collectOrphanedJobs drops it.
    }
  });

  await multi.exec();

  if (promoted > 0) {
    log.info("Promoted delayed email retries", { count: promoted });
  }
  return promoted;
}

/**
 * Pop the highest-priority ready job and mark it as processing.
 * Returns null when the queue is empty.
 */
export async function dequeueEmail(): Promise<EmailJob | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  const [jobId] = await redis.zpopmin(QUEUE_KEY, 1);
  if (!jobId) return null;

  const jobData = await redis.get(jobKey(jobId));
  if (!jobData) {
    // Payload expired or was deleted — drop the dangling queue entry.
    log.warn("Email job payload missing, dropping queue entry", { jobId });
    return null;
  }

  await redis.sadd(PROCESSING_KEY, jobId);
  return JSON.parse(jobData) as EmailJob;
}

/**
 * Mark a job as completed: leaves processing, records completion, and lets
 * the payload expire so finished jobs do not accumulate in Redis.
 */
export async function completeEmail(jobId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  await redis
    .multi()
    .srem(PROCESSING_KEY, jobId)
    .zadd(COMPLETED_KEY, Date.now(), jobId)
    .zremrangebyrank(COMPLETED_KEY, 0, -(COMPLETED_KEEP + 1))
    .expire(jobKey(jobId), JOB_TTL_SECONDS)
    .exec();
}

export interface FailEmailResult {
  retry: boolean;
  nextAttemptAt?: string;
}

/**
 * Record a delivery failure. Schedules a delayed retry with exponential
 * backoff, or moves the job to the dead-letter set once retries are exhausted.
 */
export async function failEmail(jobId: string, error: string): Promise<FailEmailResult> {
  const redis = getRedisClient();
  if (!redis) return { retry: false };

  const jobData = await redis.get(jobKey(jobId));
  if (!jobData) {
    await redis.srem(PROCESSING_KEY, jobId);
    log.warn("Failed email job payload not found", { jobId });
    return { retry: false };
  }

  const job: EmailJob = JSON.parse(jobData);
  job.retries += 1;
  job.error = error;
  job.updatedAt = new Date().toISOString();

  const exhausted = job.retries >= job.maxRetries;

  if (exhausted) {
    await redis
      .multi()
      .set(jobKey(jobId), JSON.stringify(job))
      .expire(jobKey(jobId), JOB_TTL_SECONDS)
      .srem(PROCESSING_KEY, jobId)
      .zadd(DEAD_KEY, Date.now(), jobId)
      .exec();

    log.error("Email moved to dead letter queue", {
      jobId,
      to: job.to,
      retries: job.retries,
      error,
    });
    return { retry: false };
  }

  const delayMs = RETRY_DELAYS_MS[Math.min(job.retries - 1, RETRY_DELAYS_MS.length - 1)];
  const eligibleAt = Date.now() + delayMs;
  job.nextAttemptAt = new Date(eligibleAt).toISOString();

  // The job waits in the retry set (scored by when it becomes eligible), NOT
  // in the main queue — otherwise the next dequeue would send it immediately
  // and the backoff would be meaningless.
  await redis
    .multi()
    .set(jobKey(jobId), JSON.stringify(job))
    .srem(PROCESSING_KEY, jobId)
    .zadd(RETRY_KEY, eligibleAt, jobId)
    .exec();

  log.warn("Email retry scheduled", {
    jobId,
    attempt: job.retries,
    maxRetries: job.maxRetries,
    delayMs,
    nextAttemptAt: job.nextAttemptAt,
  });

  return { retry: true, nextAttemptAt: job.nextAttemptAt };
}

/**
 * Drop queue entries whose payload is gone and release jobs stuck in
 * processing longer than PROCESSING_TTL_MS (worker crashed mid-send).
 */
export async function collectOrphanedJobs(): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  const inFlight = await redis.smembers(PROCESSING_KEY);
  if (inFlight.length === 0) return 0;

  let collected = 0;
  for (const jobId of inFlight) {
    const raw = await redis.get(jobKey(jobId));
    if (!raw) {
      await redis.srem(PROCESSING_KEY, jobId);
      collected += 1;
      continue;
    }
    try {
      const job: EmailJob = JSON.parse(raw);
      if (Date.now() - new Date(job.updatedAt).getTime() > PROCESSING_TTL_MS) {
        // Re-queue rather than lose it: failEmail applies the normal backoff.
        await failEmail(jobId, "stale: no completion signal within processing window");
        collected += 1;
      }
    } catch {
      await redis.srem(PROCESSING_KEY, jobId);
      collected += 1;
    }
  }

  return collected;
}

/**
 * Remove a job from every queue structure (cancellation / manual cleanup).
 */
export async function removeEmailJob(jobId: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  const results = await redis
    .multi()
    .zrem(QUEUE_KEY, jobId)
    .zrem(RETRY_KEY, jobId)
    .srem(PROCESSING_KEY, jobId)
    .zrem(COMPLETED_KEY, jobId)
    .zrem(DEAD_KEY, jobId)
    .del(jobKey(jobId))
    .exec();

  if (!results) return false;
  return results.some(([err, removed]) => !err && Number(removed) > 0);
}

/**
 * Queue counters, including a per-priority breakdown of the pending backlog.
 */
export async function getQueueStats(): Promise<QueueStats> {
  const empty: QueueStats = {
    pending: 0,
    delayed: 0,
    processing: 0,
    completed: 0,
    dead: 0,
    byPriority: { low: 0, normal: 0, high: 0, urgent: 0 },
  };

  const redis = getRedisClient();
  if (!redis) return empty;

  const [pending, delayed, processing, completed, dead, queueIds] = await Promise.all([
    redis.zcard(QUEUE_KEY),
    redis.zcard(RETRY_KEY),
    redis.scard(PROCESSING_KEY),
    redis.zcard(COMPLETED_KEY),
    redis.zcard(DEAD_KEY),
    // Cap the scan: an admin counter must not materialise an unbounded backlog.
    redis.zrange(QUEUE_KEY, 0, 499),
  ]);

  const byPriority: Record<EmailPriority, number> = { low: 0, normal: 0, high: 0, urgent: 0 };
  if (queueIds.length > 0) {
    const payloads = await redis.mget(queueIds.map(jobKey));
    for (const raw of payloads) {
      if (!raw) continue;
      try {
        const job: EmailJob = JSON.parse(raw);
        if (job.priority in byPriority) byPriority[job.priority] += 1;
      } catch {
        // Ignore malformed payloads.
      }
    }
  }

  return { pending, delayed, processing, completed, dead, byPriority };
}

/**
 * List dead-letter jobs (retries exhausted), oldest first.
 */
export async function listDeadEmails(limit = 20): Promise<EmailJob[]> {
  const redis = getRedisClient();
  if (!redis) return [];

  const jobIds = await redis.zrange(DEAD_KEY, 0, Math.max(0, limit) - 1);
  if (jobIds.length === 0) return [];

  const payloads = await redis.mget(jobIds.map(jobKey));
  const jobs: EmailJob[] = [];
  for (const raw of payloads) {
    if (!raw) continue;
    try {
      jobs.push(JSON.parse(raw) as EmailJob);
    } catch {
      // Skip malformed payloads.
    }
  }
  return jobs;
}

/** Drop the completed-jobs index and let their payloads expire. */
export async function purgeCompletedJobs(): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  const jobIds = await redis.zrange(COMPLETED_KEY, 0, -1);
  if (jobIds.length === 0) return 0;

  const multi = redis.multi().del(COMPLETED_KEY);
  for (const jobId of jobIds) {
    multi.expire(jobKey(jobId), 60);
  }
  await multi.exec();
  return jobIds.length;
}

/** Empty the dead-letter queue after manual review. */
export async function purgeDeadLetterQueue(): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  const jobIds = await redis.zrange(DEAD_KEY, 0, -1);
  if (jobIds.length === 0) return 0;

  const multi = redis.multi().del(DEAD_KEY);
  for (const jobId of jobIds) {
    multi.del(jobKey(jobId));
  }
  await multi.exec();
  return jobIds.length;
}

/** Re-queue every dead-letter job with a fresh retry budget. */
export async function retryDeadEmails(): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  const jobIds = await redis.zrange(DEAD_KEY, 0, -1);
  if (jobIds.length === 0) return 0;

  const payloads = await redis.mget(jobIds.map(jobKey));
  const multi = redis.multi().del(DEAD_KEY);
  let count = 0;

  jobIds.forEach((jobId, i) => {
    const raw = payloads[i];
    if (!raw) return;
    try {
      const job: EmailJob = JSON.parse(raw);
      job.retries = 0;
      job.error = undefined;
      job.nextAttemptAt = undefined;
      job.updatedAt = new Date().toISOString();
      multi.set(jobKey(jobId), JSON.stringify(job));
      multi.zadd(QUEUE_KEY, queueScore(job.priority, Date.now()), jobId);
      count += 1;
    } catch {
      multi.del(jobKey(jobId));
    }
  });

  await multi.exec();
  return count;
}
