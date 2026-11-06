/**
 * Web Vitals aggregation.
 *
 * Next.js reports Core Web Vitals (LCP, INP, CLS, FCP, TTFB) from the browser;
 * this module keeps the aggregate server-side so `/api/metrics` can expose
 * real-user numbers instead of only process statistics.
 *
 * One Redis sorted set per metric. The score is the **collection timestamp**,
 * not the observed value: that makes age-based trimming exact
 * (`zremrangebyscore`) and lets the reader ask for a recent window. The value
 * itself travels inside the member (`<value>:<rating>:<path>:<uuid>`) and the
 * percentile is computed in JS over the fetched members — the sample count is
 * capped at `MAX_SAMPLES` per metric, so the fetch stays small.
 *
 * When Redis is not configured the samples are dropped: metrics are
 * diagnostics, never a correctness requirement, so degrading silently is the
 * right trade-off.
 */

import { randomUUID } from "node:crypto";
import { getRedisClient } from "@/lib/redis";
import { log } from "@/lib/logger";

export const WEB_VITAL_NAMES = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
export type WebVitalName = (typeof WEB_VITAL_NAMES)[number];

/** Per-metric sample cap — keeps the aggregate read cheap. */
export const MAX_SAMPLES = 1000;
/** Samples older than this are irrelevant for a rolling health picture. */
export const SAMPLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Hard cap on a single ingest request. */
export const MAX_BATCH = 20;

export interface WebVitalSample {
  name: WebVitalName;
  /** Observed value in the metric's native unit (ms, or unitless for CLS). */
  value: number;
  /** Page path the sample was collected on. */
  path?: string;
  /** Rating from the browser: "good" | "needs-improvement" | "poor". */
  rating?: string;
}

export interface WebVitalStat {
  name: WebVitalName;
  count: number;
  p50: number | null;
  p75: number | null;
  p95: number | null;
  /** Threshold used to grade p75, so callers can judge without a lookup table. */
  goodThreshold: number;
  /** True when p75 is within the "good" threshold. */
  healthy: boolean;
}

export interface WebVitalsSummary {
  /** False when Redis is not configured — "not collecting" vs "no data yet". */
  enabled: boolean;
  totalSamples: number;
  metrics: WebVitalStat[];
  updatedAt: string;
}

/**
 * Core Web Vitals "good" thresholds (p75), from https://web.dev/articles/vitals
 */
const GOOD_THRESHOLDS: Record<WebVitalName, number> = {
  LCP: 2500,
  INP: 200,
  CLS: 0.1,
  FCP: 1800,
  TTFB: 800,
};

const METRIC_KEY = (name: WebVitalName) => `webvitals:${name}`;

function isWebVitalName(value: unknown): value is WebVitalName {
  return typeof value === "string" && (WEB_VITAL_NAMES as readonly string[]).includes(value);
}

/**
 * Validate a raw metric and coerce its value. Rejects anything that would
 * poison percentiles (NaN, Infinity, negative durations) and over-long strings.
 */
export function normalizeSample(input: unknown): WebVitalSample | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  if (!isWebVitalName(raw.name)) return null;
  const value = typeof raw.value === "number" ? raw.value : Number(raw.value);
  if (!Number.isFinite(value) || value < 0) return null;

  const path =
    typeof raw.path === "string" && raw.path.length > 0 && raw.path.length <= 300
      ? // ":" is the member separator, so it must not appear inside a field.
        raw.path.replace(/:/g, "_")
      : undefined;
  const rating =
    typeof raw.rating === "string" && raw.rating.length <= 32
      ? raw.rating.replace(/:/g, "_")
      : undefined;

  return { name: raw.name, value, path, rating };
}

/** Serialize a sample as a sorted-set member; the value is the first field. */
function toMember(sample: WebVitalSample, id: string): string {
  return `${sample.value}:${sample.rating ?? "-"}:${sample.path ?? "-"}:${id}`;
}

/** Extract the observed value back out of a member. */
export function parseMemberValue(member: string): number | null {
  if (typeof member !== "string" || member.length === 0) return null;
  const head = member.split(":", 1)[0];
  // `Number("")` is 0, so an empty head must be rejected explicitly — a
  // zero-length field would otherwise inject a bogus 0 ms sample.
  if (head.length === 0) return null;
  const parsed = Number(head);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Persist a batch of samples. Returns how many were accepted.
 * Never throws: a metrics write failure must not break the caller's request.
 */
export async function recordWebVitals(samples: unknown[]): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  const normalized = samples
    .slice(0, MAX_BATCH)
    .map(normalizeSample)
    .filter((s): s is WebVitalSample => s !== null);

  if (normalized.length === 0) return 0;

  const now = Date.now();
  try {
    // One pipeline for the whole batch: the browser reports several metrics at
    // once, and a round-trip per sample would make the beacon slow.
    const pipeline = redis.pipeline();
    for (const sample of normalized) {
      // Unique member: a repeated (value, path) pair must not overwrite an
      // earlier sample, otherwise the distribution under-counts.
      pipeline.zadd(METRIC_KEY(sample.name), now, toMember(sample, randomUUID()));
    }
    await pipeline.exec();

    await trimWebVitals(now);
    return normalized.length;
  } catch (error: unknown) {
    log.warn("Failed to record web vitals", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Drop samples that fell out of the retention window and, if a metric is still
 * over `MAX_SAMPLES`, the oldest excess. Returns how many members were removed.
 */
export async function trimWebVitals(now: number = Date.now()): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  const cutoff = now - SAMPLE_TTL_MS;
  let removed = 0;

  try {
    for (const name of WEB_VITAL_NAMES) {
      const key = METRIC_KEY(name);
      removed += await redis.zremrangebyscore(key, 0, cutoff);

      const size = await redis.zcard(key);
      if (size > MAX_SAMPLES) {
        // Score is the timestamp, so rank order is age order: the first
        // `excess` members are exactly the oldest ones.
        const excess = size - MAX_SAMPLES;
        const dropped = await redis.zremrangebyrank(key, 0, excess - 1);
        removed += dropped;
      }
    }
  } catch (error: unknown) {
    log.warn("Failed to trim web vitals", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return removed;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  // Nearest-rank percentile: index = ceil(p/100 * n) - 1
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function emptySummary(enabled: boolean): WebVitalsSummary {
  return {
    enabled,
    totalSamples: 0,
    metrics: WEB_VITAL_NAMES.map((name) => ({
      name,
      count: 0,
      p50: null,
      p75: null,
      p95: null,
      goodThreshold: GOOD_THRESHOLDS[name],
      healthy: false,
    })),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Read the aggregate for all metrics. Optionally restrict to samples collected
 * in the last `windowMs` (default: the whole retention window).
 */
export async function getWebVitalsSummary(options: {
  windowMs?: number;
} = {}): Promise<WebVitalsSummary> {
  const redis = getRedisClient();
  if (!redis) return emptySummary(false);

  const now = Date.now();
  const minScore = now - Math.min(options.windowMs ?? SAMPLE_TTL_MS, SAMPLE_TTL_MS);

  try {
    const metrics: WebVitalStat[] = [];
    for (const name of WEB_VITAL_NAMES) {
      const members = await redis.zrangebyscore(METRIC_KEY(name), minScore, "+inf");
      const values = (Array.isArray(members) ? members : [])
        .map(parseMemberValue)
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b);

      const p75 = percentile(values, 75);
      metrics.push({
        name,
        count: values.length,
        p50: percentile(values, 50),
        p75,
        p95: percentile(values, 95),
        goodThreshold: GOOD_THRESHOLDS[name],
        healthy: p75 !== null && p75 <= GOOD_THRESHOLDS[name],
      });
    }

    return {
      enabled: true,
      totalSamples: metrics.reduce((sum, m) => sum + m.count, 0),
      metrics,
      updatedAt: new Date(now).toISOString(),
    };
  } catch (error: unknown) {
    log.warn("Failed to read web vitals summary", {
      error: error instanceof Error ? error.message : String(error),
    });
    return emptySummary(true);
  }
}

/** Drop every collected sample (admin maintenance). */
export async function resetWebVitals(): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(...WEB_VITAL_NAMES.map((name) => METRIC_KEY(name)));
  } catch (error: unknown) {
    log.warn("Failed to reset web vitals", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
