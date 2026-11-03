import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getQueueStats } from "@/lib/email-queue";
import { requireEmailQueueSecret } from "@/lib/email-queue-auth";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("emailQueueStats", {
  windowMs: 60_000,
  maxRequests: 10,
});

/**
 * GET /api/emails/stats
 *
 * Queue counters: pending / processing / completed / failed / dead,
 * plus a per-priority breakdown of the pending backlog.
 * Protected by EMAIL_QUEUE_SECRET — the counters expose recipient volumes.
 */
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const authError = requireEmailQueueSecret(request);
  if (authError) return authError;

  const stats = await getQueueStats();

  return NextResponse.json(
    { success: true, stats },
    { headers: { "Cache-Control": "no-store" } },
  );
}
