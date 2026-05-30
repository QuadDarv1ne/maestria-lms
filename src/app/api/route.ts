import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";

const checkRateLimit = rateLimit("health", { windowMs: 60000, maxRequests: 30 });

const startTime = Date.now();

function getUptime(): string {
  const elapsed = Date.now() - startTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function getMemoryUsage(): Record<string, number> {
  const mem = process.memoryUsage();
  return {
    rss: Math.round(mem.rss / 1024 / 1024), // MB
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    external: Math.round(mem.external / 1024 / 1024),
  };
}

async function checkDatabase(): Promise<{ status: string; latencyMs: number }> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: "connected", latencyMs: Date.now() - start };
  } catch (error: unknown) {
    log.warn("Health check: database unreachable", { error: error instanceof Error ? error.message : String(error) });
    return { status: "unreachable", latencyMs: Date.now() - start };
  }
}

async function checkRedis(): Promise<{ status: string; latencyMs: number }> {
  const start = Date.now();
  const redisUrl = env.redisUrl;
  if (!redisUrl) {
    return { status: "not configured", latencyMs: 0 };
  }

  try {
    const Redis = (await import("ioredis")).default;
    const redis = new Redis(redisUrl, { connectTimeout: 2000, maxRetriesPerRequest: 1 });
    await redis.ping();
    await redis.quit();
    return { status: "connected", latencyMs: Date.now() - start };
  } catch {
    return { status: "unreachable", latencyMs: Date.now() - start };
  }
}

// GET: Enhanced health check endpoint for monitoring and uptime checks
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get("detailed") === "true";

  const [dbCheck, redisCheck] = await Promise.all([
    checkDatabase(),
    detailed ? checkRedis() : { status: "skipped", latencyMs: 0 },
  ]);

  const overallStatus =
    dbCheck.status === "connected" && (redisCheck.status === "connected" || redisCheck.status === "not configured" || redisCheck.status === "skipped")
      ? "ok"
      : "degraded";

  const response: Record<string, unknown> = {
    status: overallStatus,
    service: "Maestria LMS",
    version: process.env.npm_package_version || "3.1.0",
    uptime: getUptime(),
    timestamp: new Date().toISOString(),
    database: dbCheck,
  };

  if (detailed) {
    response.redis = redisCheck;
    response.memory = getMemoryUsage();
    response.nodeVersion = process.version;
    response.platform = process.platform;
  }

  const statusToCode = overallStatus === "ok" ? 200 : 503;

  return NextResponse.json(response, { status: statusToCode });
}
