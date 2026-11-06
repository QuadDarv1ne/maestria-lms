/**
 * Admin audit trail.
 *
 * Every privileged mutation (role change, course publish, refund, settings
 * toggle…) writes one row here. The trail is the only durable record of *who*
 * changed *what*: `server.log` rotates, and the admin "Logs" tab used to show
 * demo data.
 *
 * Two rules shape the implementation:
 *
 * 1. **The actor is a snapshot, not a relation.** `Payment.userId` cascades and
 *    account erasure anonymises the User row, so a foreign key would either
 *    block erasure or take the trail with it. Copying id/email/name at write
 *    time keeps entries readable after the account is gone.
 * 2. **Writing must never break the operation it audits.** A failed audit
 *    insert is logged and swallowed: refusing a refund because the log table is
 *    full would be worse than losing one entry.
 */

import { db, Prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { getClientIp } from "@/lib/rate-limit";

/**
 * Stable, dotted action identifiers. Kept in one place so the UI can map them
 * to icons/colours and the API can validate filters against a closed set.
 */
export const AUDIT_ACTIONS = {
  userRoleChange: "user.role_change",
  userStatusChange: "user.status_change",
  userUpdate: "user.update",
  courseCreate: "course.create",
  courseUpdate: "course.update",
  coursePublish: "course.publish",
  courseUnpublish: "course.unpublish",
  courseDelete: "course.delete",
  categoryCreate: "category.create",
  categoryUpdate: "category.update",
  categoryDelete: "category.delete",
  promoCodeCreate: "promo_code.create",
  promoCodeUpdate: "promo_code.update",
  promoCodeDelete: "promo_code.delete",
  promoCodeDeactivate: "promo_code.deactivate",
  paymentRefund: "payment.refund",
  submissionGrade: "submission.grade",
  settingsUpdate: "settings.update",
  featureFlagUpdate: "feature_flag.update",
  cacheClear: "cache.clear",
  backupCreate: "backup.create",
  auditLogPurge: "audit_log.purge",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ACTION_VALUES: AuditAction[] = Object.values(AUDIT_ACTIONS);

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === "string" && (AUDIT_ACTION_VALUES as string[]).includes(value);
}

/** Entries older than this are dropped by `cleanupOldAuditLogs`. */
export const AUDIT_LOG_RETENTION_DAYS = 365;

/** Hard cap on the stored metadata blob -- the trail must not become a payload dump. */
const MAX_METADATA_BYTES = 4096;

/**
 * Field names whose values are replaced before storing. The audit trail is
 * admin-only, but a leaked trail must not leak credentials as well.
 */
const REDACTED_KEY_PATTERN = /pass|secret|token|hash|apikey|api_key|authorization|cookie/i;

export interface AuditActor {
  id?: string | null;
  email?: string | null;
  name?: string | null;
}

export interface AuditEventInput {
  action: AuditAction;
  /** Session user, or a bare actor snapshot. */
  actor: AuditActor | null | undefined;
  entityType?: string | null;
  entityId?: string | null;
  /** Human-readable name of the affected object (course title, user email…). */
  targetLabel?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Used for ip/userAgent; the entry is still written without it. */
  request?: Request | null;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  targetLabel: string | null;
  metadata: unknown;
  ip: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  action?: string | null;
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  search?: string | null;
  /** Inclusive lower bound. */
  from?: Date | null;
  /** Exclusive upper bound. */
  to?: Date | null;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return undefined;
  if (depth > 4) return "[truncated]";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value !== "object") return undefined;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redact(item, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const cleaned = REDACTED_KEY_PATTERN.test(key) ? "[redacted]" : redact(nested, depth + 1);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

/**
 * Turn caller metadata into something Prisma can store.
 *
 * Undefined values are dropped (they would serialise as `null` and claim a
 * field was cleared), secrets are redacted, and an oversized blob is discarded
 * rather than truncated mid-structure.
 */
export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | undefined {
  if (!metadata) return undefined;
  const cleaned = redact(metadata);
  if (!cleaned || typeof cleaned !== "object" || Array.isArray(cleaned)) return undefined;

  try {
    const serialized = JSON.stringify(cleaned);
    if (serialized.length > MAX_METADATA_BYTES) return undefined;
    return cleaned as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

/**
 * Write one audit entry.
 *
 * Never throws: auditing is best-effort by design, and the caller is in the
 * middle of the mutation it is auditing.
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const ip = input.request ? getClientIp(input.request) : null;
    const userAgent = input.request?.headers.get("user-agent") ?? null;

    await db.auditLog.create({
      data: {
        actorId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        actorName: input.actor?.name ?? null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        targetLabel: input.targetLabel ?? null,
        metadata: sanitizeAuditMetadata(input.metadata),
        ip,
        userAgent: userAgent ? userAgent.slice(0, 300) : null,
      },
    });
  } catch (error: unknown) {
    log.warn("Failed to write audit log entry", {
      action: input.action,
      entityType: input.entityType ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Normalise a session user into the actor snapshot stored on the entry. */
export function auditActorFromSession(
  session: { user?: { id?: string; email?: string | null; name?: string | null } } | null | undefined,
): AuditActor | null {
  const user = session?.user;
  if (!user?.id) return null;
  return { id: user.id, email: user.email ?? null, name: user.name ?? null };
}

/**
 * Read a page of the trail, newest first.
 *
 * `search` matches the actor e-mail and the affected object label -- the two
 * fields an investigator actually knows. It stays case-insensitive on
 * PostgreSQL (where `contains` is case-sensitive) and degrades to a plain
 * `contains` elsewhere, mirroring `/api/admin/users`.
 */
export async function listAuditLogs(
  filters: AuditLogFilters,
  options: { page: number; limit: number; skip: number },
): Promise<AuditLogPage> {
  const { page, limit, skip } = options;
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.action) where.action = filters.action;
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;

  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lt: filters.to } : {}),
    };
  }

  if (filters.search) {
    const insensitive = process.env.DATABASE_URL?.startsWith("postgres") ?? false;
    const contains = insensitive
      ? { contains: filters.search, mode: "insensitive" as const }
      : { contains: filters.search };
    where.OR = [
      { actorEmail: contains },
      { actorName: contains },
      { targetLabel: contains },
      { action: contains },
    ];
  }

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    entries: rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      actorEmail: row.actorEmail,
      actorName: row.actorName,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      targetLabel: row.targetLabel,
      metadata: row.metadata ?? null,
      ip: row.ip,
      createdAt: row.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Drop entries past the retention window.
 *
 * Called opportunistically from the read endpoint (Amvera has no scheduler),
 * which keeps the table bounded without a separate cron contract.
 */
export async function cleanupOldAuditLogs(
  retentionDays: number = AUDIT_LOG_RETENTION_DAYS,
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await db.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}

/**
 * Manually purge the trail -- everything older than `before`, or all of it when
 * `before` is null. The caller records the purge itself afterwards, so the
 * entry that documents the wipe is written last and survives it.
 */
export async function purgeAuditLogs(before: Date | null): Promise<number> {
  const result = await db.auditLog.deleteMany({
    where: before ? { createdAt: { lt: before } } : {},
  });
  return result.count;
}
