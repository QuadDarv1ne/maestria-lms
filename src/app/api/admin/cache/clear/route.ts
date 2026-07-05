import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, requireAdmin } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { flushAll } from "@/lib/cache";

export const runtime = "nodejs";

const checkAdminRateLimit = rateLimit("admin", RATE_LIMITS.admin);

export async function POST(request: NextRequest) {
  const blocked = checkAdminRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    await flushAll();

    return NextResponse.json({
      message: "Cache cleared successfully",
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "POST /api/admin/cache/clear" });
  }
}
