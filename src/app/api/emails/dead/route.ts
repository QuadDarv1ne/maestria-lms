import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { log } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { listDeadEmails, purgeDeadLetterQueue, retryDeadEmails } from "@/lib/email-queue";
import { requireEmailQueueSecret } from "@/lib/email-queue-auth";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("emailQueueDead", {
  windowMs: 60_000,
  maxRequests: 10,
});

const deadSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});

const actionSchema = z.enum(["purge", "retry"]);

/**
 * GET /api/emails/dead
 *
 * List dead-letter emails that exhausted all retries.
 * Protected by EMAIL_QUEUE_SECRET.
 */
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const authError = requireEmailQueueSecret(request);
  if (authError) return authError;

  const validation = deadSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Ошибка валидации" },
      { status: 400 },
    );
  }

  const deadEmails = await listDeadEmails(validation.data.limit ?? 20);

  return NextResponse.json({ success: true, deadEmails, total: deadEmails.length });
}

/**
 * POST /api/emails/dead
 *
 * Manage the dead-letter queue: `purge` to delete, `retry` to re-enqueue.
 * Body: `{ action: "purge" | "retry" }`.
 */
export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const authError = requireEmailQueueSecret(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action. Use 'purge' or 'retry'." }, { status: 400 });
  }

  const action = parsed.data;

  try {
    if (action === "purge") {
      const count = await purgeDeadLetterQueue();
      return NextResponse.json({ success: true, purged: count });
    }

    if (action === "retry") {
      const count = await retryDeadEmails();
      return NextResponse.json({ success: true, retried: count });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    log.error("Dead letter management failed", {
      action,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}
