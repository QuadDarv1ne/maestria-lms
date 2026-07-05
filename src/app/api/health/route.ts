import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { APP_VERSION } from "@/lib/constants";
import { getRedisClient } from "@/lib/redis";

export const runtime = "nodejs";

export async function GET() {
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
  } catch {
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
  } catch {
    checks.services.cache.status = "unhealthy";
    checks.services.cache.responseTime = Date.now() - cacheStart;
  }

  const status = checks.status === "unhealthy" ? 503 : 200;
  return NextResponse.json(checks, { status });
}

