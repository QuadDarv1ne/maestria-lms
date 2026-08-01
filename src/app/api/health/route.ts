import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { APP_VERSION } from "@/lib/constants";
import { getRedisClient } from "@/lib/redis";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";
import { getDatabaseProvider } from "@/lib/db";
import { isS3Available } from "@/lib/s3";

export const runtime = "nodejs";

interface HealthCheckResult {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  version: string;
  uptime: string;
  environment: string;
  services: {
    database: { status: string; responseTime: number; provider: string };
    cache: { status: string; responseTime: number };
    storage: { status: string; configured: boolean };
    email: { status: string; configured: boolean };
  };
  memory: {
    rss: string;
    heapUsed: string;
    heapTotal: string;
  };
}

export async function GET() {
  const startTime = Date.now();

  try {
    const result: HealthCheckResult = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      uptime: formatUptime(process.uptime()),
      environment: env.nodeEnv,
      services: {
        database: { status: "unknown", responseTime: 0, provider: getDatabaseProvider() },
        cache: { status: "unknown", responseTime: 0 },
        storage: { status: "unknown", configured: isS3Available() },
        email: { status: "unknown", configured: !!env.resendApiKey },
      },
      memory: {
        rss: formatBytes(process.memoryUsage().rss),
        heapUsed: formatBytes(process.memoryUsage().heapUsed),
        heapTotal: formatBytes(process.memoryUsage().heapTotal),
      },
    };

    // Database check
    const dbStart = Date.now();
    try {
      await db.$queryRaw`SELECT 1`;
      result.services.database.status = "healthy";
      result.services.database.responseTime = Date.now() - dbStart;
    } catch (error: unknown) {
      log.warn("Health check: database unreachable", { error: error instanceof Error ? error.message : String(error) });
      result.services.database.status = "unhealthy";
      result.services.database.responseTime = Date.now() - dbStart;
      result.status = "unhealthy";
    }

    // Cache (Redis) check
    const cacheStart = Date.now();
    try {
      const redis = getRedisClient();
      if (redis) {
        await redis.ping();
        result.services.cache.status = "healthy";
      } else {
        result.services.cache.status = "unavailable";
      }
      result.services.cache.responseTime = Date.now() - cacheStart;
    } catch (error: unknown) {
      log.warn("Health check: Redis unreachable", { error: error instanceof Error ? error.message : String(error) });
      result.services.cache.status = "unhealthy";
      result.services.cache.responseTime = Date.now() - cacheStart;
      // Redis being down is not critical — mark as degraded
      if (result.status === "healthy") {
        result.status = "degraded";
      }
    }

    // Storage (S3) check
    if (result.services.storage.configured) {
      result.services.storage.status = "configured";
    } else {
      result.services.storage.status = "not_configured";
    }

    // Email (Resend) check
    if (result.services.email.configured) {
      result.services.email.status = "configured";
    } else {
      result.services.email.status = "not_configured";
    }

    const totalTime = Date.now() - startTime;
    const statusCode = result.status === "unhealthy" ? 503 : 200;

    return NextResponse.json(result, {
      status: statusCode,
      headers: {
        "X-Health-Check-Time": `${totalTime}ms`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (e: unknown) {
    log.error("Health check failed", { error: e });
    return NextResponse.json(
      {
        status: "error",
        service: "Maestria LMS",
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}

function formatUptime(uptime: number): string {
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
