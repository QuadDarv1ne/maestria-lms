// @vitest-environment node
/**
 * Unit tests for the admin audit trail (src/lib/audit-log.ts).
 *
 * Two properties matter more than the happy path:
 *
 * 1. writing never throws -- a broken audit table must not fail the mutation
 *    it is auditing;
 * 2. metadata is sanitised before it is stored -- secrets are redacted and an
 *    oversized blob is dropped instead of being truncated mid-structure.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb, mockLog } = vi.hoisted(() => ({
  mockDb: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  mockLog: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: mockDb, Prisma: {} }));
vi.mock("@/lib/logger", () => ({ log: mockLog }));
vi.mock("@/lib/rate-limit", () => ({
  getClientIp: (request: Request) =>
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anonymous",
}));

import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_VALUES,
  AUDIT_LOG_RETENTION_DAYS,
  auditActorFromSession,
  cleanupOldAuditLogs,
  isAuditAction,
  listAuditLogs,
  purgeAuditLogs,
  recordAuditEvent,
  sanitizeAuditMetadata,
} from "@/lib/audit-log";

const ADMIN = { id: "admin-1", email: "admin@example.com", name: "Admin" };

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/admin/users", { method: "PUT", headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });
  mockDb.auditLog.findMany.mockResolvedValue([]);
  mockDb.auditLog.count.mockResolvedValue(0);
  mockDb.auditLog.deleteMany.mockResolvedValue({ count: 0 });
});

describe("AUDIT_ACTIONS catalogue", () => {
  it("exposes unique dotted identifiers", () => {
    expect(new Set(AUDIT_ACTION_VALUES).size).toBe(AUDIT_ACTION_VALUES.length);
    for (const action of AUDIT_ACTION_VALUES) {
      expect(action).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it("recognises only catalogue values", () => {
    expect(isAuditAction("course.publish")).toBe(true);
    expect(isAuditAction("course.nope")).toBe(false);
    expect(isAuditAction("")).toBe(false);
    expect(isAuditAction(null)).toBe(false);
    expect(isAuditAction(42)).toBe(false);
  });
});

describe("sanitizeAuditMetadata", () => {
  it("returns undefined for absent metadata", () => {
    expect(sanitizeAuditMetadata(null)).toBeUndefined();
    expect(sanitizeAuditMetadata(undefined)).toBeUndefined();
    expect(sanitizeAuditMetadata({})).toEqual({});
  });

  it("redacts credential-looking keys at any depth", () => {
    const cleaned = sanitizeAuditMetadata({
      password: "hunter2",
      nested: { apiKey: "sk-live", newPassword: "x" },
      keep: "value",
    });

    expect(cleaned).toEqual({
      password: "[redacted]",
      nested: { apiKey: "[redacted]", newPassword: "[redacted]" },
      keep: "value",
    });
  });

  it("drops undefined values instead of storing them as null", () => {
    expect(sanitizeAuditMetadata({ a: undefined, b: 1 })).toEqual({ b: 1 });
  });

  it("truncates long strings and caps arrays", () => {
    const cleaned = sanitizeAuditMetadata({
      long: "x".repeat(600),
      many: Array.from({ length: 30 }, (_, i) => i),
    }) as Record<string, unknown>;

    expect((cleaned.long as string).endsWith("…")).toBe(true);
    expect((cleaned.long as string).length).toBe(501);
    expect((cleaned.many as unknown[]).length).toBe(20);
  });

  it("discards an oversized blob rather than truncating it", () => {
    // Long values are already capped per string, so size can only blow up
    // through sheer key count -- which is exactly the case worth dropping.
    const huge: Record<string, unknown> = {};
    for (let i = 0; i < 200; i++) huge[`field${i}`] = "z".repeat(40);

    expect(sanitizeAuditMetadata(huge)).toBeUndefined();
  });

  it("serialises Date values", () => {
    const when = new Date("2026-01-02T03:04:05.000Z");
    expect(sanitizeAuditMetadata({ when })).toEqual({ when: when.toISOString() });
  });
});

describe("recordAuditEvent", () => {
  it("writes the actor snapshot, action and request context", async () => {
    await recordAuditEvent({
      action: AUDIT_ACTIONS.userRoleChange,
      actor: ADMIN,
      entityType: "user",
      entityId: "user-9",
      targetLabel: "student@example.com",
      metadata: { changes: { role: { from: "student", to: "teacher" } } },
      request: request({
        "x-forwarded-for": "203.0.113.7",
        "user-agent": "Mozilla/5.0",
      }),
    });

    expect(mockDb.auditLog.create).toHaveBeenCalledTimes(1);
    expect(mockDb.auditLog.create.mock.calls[0][0]).toEqual({
      data: {
        actorId: "admin-1",
        actorEmail: "admin@example.com",
        actorName: "Admin",
        action: "user.role_change",
        entityType: "user",
        entityId: "user-9",
        targetLabel: "student@example.com",
        metadata: { changes: { role: { from: "student", to: "teacher" } } },
        ip: "203.0.113.7",
        userAgent: "Mozilla/5.0",
      },
    });
  });

  it("tolerates a missing actor and missing request", async () => {
    await recordAuditEvent({ action: AUDIT_ACTIONS.cacheClear, actor: null });

    const data = mockDb.auditLog.create.mock.calls[0][0].data;
    expect(data.actorId).toBeNull();
    expect(data.ip).toBeNull();
    expect(data.userAgent).toBeNull();
    expect(data.metadata).toBeUndefined();
  });

  it("truncates an over-long user agent", async () => {
    await recordAuditEvent({
      action: AUDIT_ACTIONS.settingsUpdate,
      actor: ADMIN,
      request: request({ "user-agent": "u".repeat(1000) }),
    });

    expect(mockDb.auditLog.create.mock.calls[0][0].data.userAgent.length).toBe(300);
  });

  it("swallows a database failure instead of breaking the audited mutation", async () => {
    mockDb.auditLog.create.mockRejectedValue(new Error("table is on fire"));

    await expect(
      recordAuditEvent({ action: AUDIT_ACTIONS.paymentRefund, actor: ADMIN }),
    ).resolves.toBeUndefined();

    expect(mockLog.warn).toHaveBeenCalledWith(
      "Failed to write audit log entry",
      expect.objectContaining({ action: "payment.refund", error: "table is on fire" }),
    );
  });
});

describe("auditActorFromSession", () => {
  it("builds a snapshot from a session user", () => {
    expect(auditActorFromSession({ user: ADMIN })).toEqual({
      id: "admin-1",
      email: "admin@example.com",
      name: "Admin",
    });
  });

  it("returns null without a user id", () => {
    expect(auditActorFromSession(null)).toBeNull();
    expect(auditActorFromSession({})).toBeNull();
    expect(auditActorFromSession({ user: {} })).toBeNull();
  });
});

describe("listAuditLogs", () => {
  function row(overrides: Record<string, unknown> = {}) {
    return {
      id: "log-1",
      actorId: "admin-1",
      actorEmail: "admin@example.com",
      actorName: "Admin",
      action: "course.publish",
      entityType: "course",
      entityId: "course-1",
      targetLabel: "TypeScript",
      metadata: null,
      ip: "203.0.113.7",
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      ...overrides,
    };
  }

  it("maps rows to the API shape with an ISO timestamp", async () => {
    mockDb.auditLog.findMany.mockResolvedValue([row()]);
    mockDb.auditLog.count.mockResolvedValue(1);

    const page = await listAuditLogs({}, { page: 1, limit: 50, skip: 0 });

    expect(page.entries[0].createdAt).toBe("2026-01-02T03:04:05.000Z");
    expect(page.pagination).toEqual({ page: 1, limit: 50, total: 1, totalPages: 1 });
    expect(mockDb.auditLog.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: "desc" });
  });

  it("builds a filter for every supported parameter", async () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-02-01T00:00:00.000Z");

    await listAuditLogs(
      {
        action: "course.publish",
        actorId: "admin-1",
        entityType: "course",
        entityId: "course-1",
        from,
        to,
      },
      { page: 2, limit: 10, skip: 10 },
    );

    const where = mockDb.auditLog.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      action: "course.publish",
      actorId: "admin-1",
      entityType: "course",
      entityId: "course-1",
      createdAt: { gte: from, lt: to },
    });
    expect(mockDb.auditLog.findMany.mock.calls[0][0].skip).toBe(10);
    expect(mockDb.auditLog.findMany.mock.calls[0][0].take).toBe(10);
  });

  it("searches actor e-mail, name, target label and action", async () => {
    await listAuditLogs({ search: "anna" }, { page: 1, limit: 50, skip: 0 });

    const where = mockDb.auditLog.findMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(4);
    expect(where.OR.map((clause: Record<string, unknown>) => Object.keys(clause)[0])).toEqual([
      "actorEmail",
      "actorName",
      "targetLabel",
      "action",
    ]);
  });

  it("computes totalPages from the count", async () => {
    mockDb.auditLog.count.mockResolvedValue(101);

    const page = await listAuditLogs({}, { page: 3, limit: 50, skip: 100 });

    expect(page.pagination.totalPages).toBe(3);
  });

  it("returns an empty page when nothing matches", async () => {
    const page = await listAuditLogs({ action: "user.update" }, { page: 1, limit: 50, skip: 0 });

    expect(page.entries).toEqual([]);
    expect(page.pagination.totalPages).toBe(0);
  });
});

describe("retention", () => {
  it("deletes entries older than the retention window", async () => {
    mockDb.auditLog.deleteMany.mockResolvedValue({ count: 4 });
    const before = Date.now();

    const removed = await cleanupOldAuditLogs();
    const cutoff = mockDb.auditLog.deleteMany.mock.calls[0][0].where.createdAt.lt as Date;

    expect(removed).toBe(4);
    const expected = before - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(5000);
  });

  it("honours a custom retention period", async () => {
    await cleanupOldAuditLogs(7);
    const cutoff = mockDb.auditLog.deleteMany.mock.calls[0][0].where.createdAt.lt as Date;
    const days = (Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000);

    expect(Math.round(days)).toBe(7);
  });

  it("purges everything when no cutoff is given", async () => {
    mockDb.auditLog.deleteMany.mockResolvedValue({ count: 9 });

    expect(await purgeAuditLogs(null)).toBe(9);
    expect(mockDb.auditLog.deleteMany.mock.calls[0][0]).toEqual({ where: {} });
  });

  it("purges only entries older than the cutoff", async () => {
    const before = new Date("2026-03-01T00:00:00.000Z");

    await purgeAuditLogs(before);

    expect(mockDb.auditLog.deleteMany.mock.calls[0][0]).toEqual({
      where: { createdAt: { lt: before } },
    });
  });
});
