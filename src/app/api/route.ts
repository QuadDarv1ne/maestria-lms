import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const checkRateLimit = rateLimit("health", { windowMs: 60000, maxRequests: 30 });

// GET: Health check endpoint for monitoring and uptime checks
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  return NextResponse.json({
    status: "ok",
    service: "Maestria LMS",
    timestamp: new Date().toISOString(),
  });
}