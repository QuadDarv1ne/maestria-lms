import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, requireAuth, authErrorResponse, requireAdmin, adminErrorResponse } from "@/lib/auth";
import { addRateLimitHeaders } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import fs from "fs";
import path from "path";

/**
 * GET /api/admin/logs
 *
 * Returns recent application log entries.
 * Only accessible by admin users.
 * Supports filtering by level and searching.
 *
 * Query params:
 *   - level: error | warn | info (optional filter)
 *   - search: string (optional text search)
 *   - lines: number (default 50, max 200)
 */
export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!requireAuth(session)) return authErrorResponse();
  if (!requireAdmin(session)) return adminErrorResponse();

  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level") ?? null;
  const search = searchParams.get("search") ?? null;
  const lines = Math.min(Math.max(parseInt(searchParams.get("lines") ?? "50", 10) || 50, 10), 200);

  const responseHeaders = new Headers();
  addRateLimitHeaders(responseHeaders, "admin", request, session.user.id);

  try {
    // Try common log file locations
    const logPaths = [
      path.resolve(process.cwd(), "server.log"),
      path.resolve(process.cwd(), "dev.log"),
      path.resolve(process.cwd(), "logs", "app.log"),
      path.resolve(process.cwd(), ".next", "server.log"),
    ];

    let logContent = "";
    let logFile = "";

    for (const logPath of logPaths) {
      if (fs.existsSync(logPath)) {
        logContent = fs.readFileSync(logPath, "utf-8");
        logFile = path.basename(logPath);
        break;
      }
    }

    if (!logContent) {
      return NextResponse.json(
        {
          data: {
            entries: [],
            total: 0,
            logFile: null,
            message: "No log file found. Ensure logging is configured.",
          },
        },
        { headers: responseHeaders },
      );
    }

    // Parse log lines
    let entries = logContent
      .split("\n")
      .filter(Boolean)
      .reverse(); // newest first

    // Filter by level
    if (level) {
      const levelLower = level.toLowerCase();
      entries = entries.filter((line) => {
        const lineLower = line.toLowerCase();
        if (levelLower === "error") return lineLower.includes("[error]") || lineLower.includes("error:");
        if (levelLower === "warn") return lineLower.includes("[warn]") || lineLower.includes("warn:");
        if (levelLower === "info") return lineLower.includes("[info]") || lineLower.includes("info:");
        return true;
      });
    }

    // Filter by search text
    if (search) {
      const searchLower = search.toLowerCase();
      entries = entries.filter((line) => line.toLowerCase().includes(searchLower));
    }

    // Limit
    const limited = entries.slice(0, lines);

    return NextResponse.json(
      {
        data: {
          entries: limited,
          total: entries.length,
          displayed: limited.length,
          logFile,
        },
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    log.error("Failed to read logs", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to read log files", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}