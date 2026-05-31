import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, requireAdmin } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const checkAdminRateLimit = rateLimit("admin", RATE_LIMITS.admin);

export async function POST(request: NextRequest) {
  const blocked = checkAdminRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    // Clear Next.js server cache directory
    const cacheDir = [
      process.cwd() + "/.next/cache",
    ];

    const cleared: string[] = [];
    for (const dir of cacheDir) {
      try {
        const fs = await import("fs");
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
          cleared.push(dir);
        }
      } catch {
        // Directory may not exist or be locked
      }
    }

    return NextResponse.json({
      message: "Cache cleared successfully",
      cleared,
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "POST /api/admin/cache/clear" });
  }
}
