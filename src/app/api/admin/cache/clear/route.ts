import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api-errors";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return apiError("Unauthorized", 401);
    }

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
  } catch (error) {
    return handleApiError(error, "POST /api/admin/cache/clear");
  }
}
