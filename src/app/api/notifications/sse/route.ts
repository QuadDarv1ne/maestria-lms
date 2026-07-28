import { NextRequest } from "next/server";
import { getAuthSession, requireAuth, authErrorResponse } from "@/lib/auth";
import { addClient } from "@/lib/sse";
import { log } from "@/lib/logger";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkRateLimit = rateLimit("sse", RATE_LIMITS.sse);

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    // Rate limit SSE connections to prevent connection exhaustion
    const limitResponse = checkRateLimit(req, session.user.id);
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
        } catch (error: unknown) {
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

        // Prevent the heartbeat from keeping the process alive in serverless
        if (typeof heartbeat === "object" && "unref" in heartbeat) {
          (heartbeat as NodeJS.Timeout).unref();
        }

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
  } catch (error: unknown) {
    log.error("SSE connection failed", { error: error instanceof Error ? error.message : String(error) });
    return handleApiError(error, { route: "sse" });
  }
}
