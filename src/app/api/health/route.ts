import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { APP_VERSION } from "@/lib/constants";
import { getRedisClient } from "@/lib/redis";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  try {
    const checks = {
      status: "healthy" as "healthy" | "unhealthy",
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      services: {
        database: { status: "unknown" as string, responseTime: 0 as number },
        cache: { status: "unknown" as string, responseTime: 0 as number },
      },
    };

    const dbStart = Date.now();
    try {
      await db.$queryRaw`SELECT 1`;
      checks.services.database.status = "healthy";
      checks.services.database.responseTime = Date.now() - dbStart;
    } catch (error: unknown) {
      log.warn("Health check: database unreachable", { error: error instanceof Error ? error.message : String(error) });
      checks.services.database.status = "unhealthy";
      checks.services.database.responseTime = Date.now() - dbStart;
      checks.status = "unhealthy";
    }

    const cacheStart = Date.now();
    try {
      const redis = getRedisClient();
      if (redis) {
        await redis.ping();
        checks.services.cache.status = "healthy";
      } else {
        checks.services.cache.status = "unavailable";
      }
      checks.services.cache.responseTime = Date.now() - cacheStart;
    } catch (error: unknown) {
      log.warn("Health check: Redis unreachable", { error: error instanceof Error ? error.message : String(error) });
      checks.services.cache.status = "unhealthy";
      checks.services.cache.responseTime = Date.now() - cacheStart;
    }

    const status = checks.status === "unhealthy" ? 503 : 200;
    return NextResponse.json(checks, { status });
  } catch (e) {
    log.error("Health check failed", { error: e });
    return NextResponse.json({ status: "error", service: "Maestria LMS", version: APP_VERSION }, { status: 503 });
  }
}

