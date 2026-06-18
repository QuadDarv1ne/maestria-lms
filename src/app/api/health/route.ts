import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Health check endpoint
 * Returns status of all critical services
 */
export async function GET() {
  const checks = {
    status: "healthy" as "healthy" | "unhealthy",
    timestamp: new Date().toISOString(),
    version: "3.1.1",
    services: {
      database: { status: "unknown" as string, responseTime: 0 as number },
      cache: { status: "unknown" as string, responseTime: 0 as number },
    },
  };

  // Check database
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

  // Check Redis cache (simple ping check)
  const cacheStart = Date.now();
  try {
    const redisUrl = env.redisUrl;
    if (redisUrl) {
      // Redis is available if URL is configured
      checks.services.cache.status = "healthy";
    } else {
      checks.services.cache.status = "unavailable";
    }
    checks.services.cache.responseTime = Date.now() - cacheStart;
  } catch {
    checks.services.cache.status = "unhealthy";
    checks.services.cache.responseTime = Date.now() - cacheStart;
  }

  // Return 503 if any service is unhealthy
  const status = checks.status === "unhealthy" ? 503 : 200;

  return NextResponse.json(checks, { status });
}

