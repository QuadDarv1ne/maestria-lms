import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";

const checkRateLimit = rateLimit("health", { windowMs: 60000, maxRequests: 30 });

// GET: Health check endpoint for monitoring and uptime checks
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  let dbStatus = "unknown";
  try {
    await db.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch {
    dbStatus = "unreachable";
  }

  return NextResponse.json({
    status: dbStatus === "connected" ? "ok" : "degraded",
    service: "Maestria LMS",
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
}