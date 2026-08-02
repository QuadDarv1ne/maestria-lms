import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, requireAuth, authErrorResponse, requireAdmin, adminErrorResponse } from "@/lib/auth";
import { addRateLimitHeaders, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { execFileSync } from "child_process";
import { env } from "@/lib/env";
import path from "path";

const checkRateLimit = rateLimit("admin", RATE_LIMITS.admin);

/**
 * POST /api/admin/backup
 *
 * Triggers an on-demand database backup.
 * Only accessible by admin users.
 * Returns the backup file path and size.
 */
export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const session = await getAuthSession();
  if (!requireAuth(session)) return authErrorResponse();
  if (!requireAdmin(session)) return adminErrorResponse();

  const responseHeaders = new Headers();
  addRateLimitHeaders(responseHeaders, "admin", request, session.user.id);

  try {
    const { searchParams } = new URL(request.url);
    const compress = searchParams.get("compress") === "true";
    const retain = parseInt(searchParams.get("retain") ?? "0", 10) || 0;

    const backupScript = path.resolve(process.cwd(), "scripts", "backup-db.js");
    const args = [backupScript];
    if (compress) args.push("--compress");
    if (retain > 0) args.push("--retain", String(retain));

    const startTime = Date.now();
    const output = execFileSync("node", args, {
      timeout: 120_000,
      encoding: "utf-8",
    });
    const duration = Date.now() - startTime;

    log.info("Admin triggered database backup", {
      adminId: session.user.id,
      compress,
      retain,
      durationMs: duration,
    });

    return NextResponse.json(
      {
        data: {
          message: "Backup completed successfully",
          duration: `${(duration / 1000).toFixed(1)}s`,
          output: output.split("\n").filter(Boolean),
        },
      },
      { headers: responseHeaders },
    );
  } catch (error: unknown) {
    log.error("Backup failed", {
      error: error instanceof Error ? error.message : String(error),
      adminId: session.user.id,
    });

    const message =
      env.isDevelopment
        ? `Backup failed: ${error instanceof Error ? error.message : String(error)}`
        : "Backup failed. Check server logs for details.";

    return NextResponse.json(
      { error: message, code: "BACKUP_FAILED" },
      { status: 500 },
    );
  }
}