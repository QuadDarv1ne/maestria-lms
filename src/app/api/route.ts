import { NextResponse } from "next/server";

// GET: Health check endpoint for monitoring and uptime checks
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Maestria LMS",
    timestamp: new Date().toISOString(),
  });
}