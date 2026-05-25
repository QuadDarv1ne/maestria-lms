import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { addClient } from "@/lib/sse";
import { log } from "@/lib/logger";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Необходимо авторизоваться" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limit SSE connections to prevent connection exhaustion
  const limitResponse = rateLimit("sse", RATE_LIMITS.sse)(req, session.user.id);
  if (limitResponse) {
    return limitResponse;
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let cleanup: (() => void) | null = null;

      try {
        cleanup = addClient(userId, controller);
      } catch (error) {
        log.error("Failed to add SSE client", { userId, error: error instanceof Error ? error.message : String(error) });
        controller.error(error);
        return;
      }

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "ping" })}\n\n`));
        } catch {
          clearInterval(heartbeat);
          cleanup?.();
        }
      }, 30000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        cleanup?.();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
