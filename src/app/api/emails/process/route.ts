import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { log } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { processEmailQueue } from "@/lib/email-worker";
import { requireEmailQueueSecret } from "@/lib/email-queue-auth";
import { getRedisClient } from "@/lib/redis";

export const runtime = "nodejs";

// The worker is meant to be invoked by an external cron (Amvera has no
// built-in scheduler) — keep the limit tight but usable for a 1-min cadence.
const checkRateLimit = rateLimit("emailQueueProcess", {
  windowMs: 60_000,
  maxRequests: 12,
});

const processSchema = z.object({
  batchSize: z.number().int().min(1).max(100).optional(),
});

/**
 * POST /api/emails/process
 *
 * Drain up to `batchSize` jobs from the email queue (highest priority first)
 * and send them through Resend. Protected by the same EMAIL_QUEUE_SECRET as
 * the enqueue endpoint. Body is optional: `{ batchSize? }`.
 */
export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const authError = requireEmailQueueSecret(request);
  if (authError) return authError;

  if (!getRedisClient()) {
    return NextResponse.json(
      { error: "Email queue is offline (Redis not available)" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  let body: unknown = {};
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const validation = processSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Ошибка валидации" },
      { status: 400 },
    );
  }

  try {
    const result = await processEmailQueue({ batchSize: validation.data.batchSize ?? 20 });
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    log.error("Email worker failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Email worker failed" }, { status: 500 });
  }
}
