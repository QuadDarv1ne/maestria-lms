import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, requireAdmin, adminErrorResponse, authErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { parsePagination } from "@/lib/utils";
import { log } from "@/lib/logger";
import {
  AUDIT_ACTIONS,
  AUDIT_LOG_RETENTION_DAYS,
  auditActorFromSession,
  cleanupOldAuditLogs,
  isAuditAction,
  listAuditLogs,
  purgeAuditLogs,
  recordAuditEvent,
} from "@/lib/audit-log";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("admin", RATE_LIMITS.admin);

/** Opportunistic retention: Amvera has no scheduler, so reads trigger the purge. */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastCleanupAt = 0;

async function maybeCleanup(): Promise<void> {
  if (Date.now() - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = Date.now();
  try {
    const removed = await cleanupOldAuditLogs();
    if (removed > 0) {
      log.info("Purged expired audit log entries", { removed, retentionDays: AUDIT_LOG_RETENTION_DAYS });
    }
  } catch (error: unknown) {
    log.warn("Audit log cleanup failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Distinguish "no bound" from "unparseable bound". On DELETE the difference is
 * the whole table: `?before=garbage` must not degrade into "delete everything".
 */
function parseRequiredDate(value: string | null): { ok: true; date: Date | null } | { ok: false } {
  if (value === null || value.trim() === "") return { ok: true, date: null };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { ok: false };
  return { ok: true, date: parsed };
}

/**
 * GET /api/admin/audit-logs
 *
 * Paginated trail of administrative actions, newest first.
 *
 * Query params: page, limit, action, actorId, entityType, entityId, search,
 * from, to (ISO dates). Unknown `action` values are rejected rather than
 * silently returning an empty list -- a typo in an investigation filter should
 * be visible.
 */
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAdmin(session)) {
      if (!session) return authErrorResponse();
      return adminErrorResponse();
    }

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams, { defaultLimit: 50, maxLimit: 200 });

    const rawAction = searchParams.get("action");
    if (rawAction && !isAuditAction(rawAction)) {
      return NextResponse.json({ error: "Unknown audit action" }, { status: 400 });
    }

    const rawSearch = searchParams.get("search");
    const search = rawSearch && rawSearch.trim().length > 0 ? rawSearch.trim().slice(0, 100) : null;

    await maybeCleanup();

    const result = await listAuditLogs(
      {
        action: rawAction,
        actorId: searchParams.get("actorId"),
        entityType: searchParams.get("entityType"),
        entityId: searchParams.get("entityId"),
        search,
        from: parseDate(searchParams.get("from")),
        to: parseDate(searchParams.get("to")),
      },
      { page, limit, skip },
    );

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/audit-logs GET" });
  }
}

/**
 * DELETE /api/admin/audit-logs
 *
 * Drops entries older than `?before=` (ISO date), or the whole trail when the
 * parameter is omitted. Destructive by nature, so the caller must also send
 * `?confirm=true`; the deletion itself is recorded as an audit event, which
 * keeps the "who wiped the trail" question answerable.
 */
export async function DELETE(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAdmin(session)) {
      if (!session) return authErrorResponse();
      return adminErrorResponse();
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get("confirm") !== "true") {
      return NextResponse.json(
        { error: "Confirmation required: pass confirm=true" },
        { status: 400 },
      );
    }

    const before = parseRequiredDate(searchParams.get("before"));
    if (!before.ok) {
      return NextResponse.json({ error: "Invalid `before` date" }, { status: 400 });
    }

    const deleted = await purgeAuditLogs(before.date);

    // Written after the purge so the record of the wipe is not itself wiped.
    await recordAuditEvent({
      action: AUDIT_ACTIONS.auditLogPurge,
      actor: auditActorFromSession(session),
      entityType: "audit_log",
      metadata: { deleted, before: before.date?.toISOString() ?? null },
      request,
    });

    return NextResponse.json(
      { deleted, before: before.date?.toISOString() ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/audit-logs DELETE" });
  }
}
