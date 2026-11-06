// @vitest-environment node
/**
 * Route-level tests for /api/admin/audit-logs.
 *
 * The endpoint exposes a security-relevant record, so the tests pin down
 * authorisation, the closed action filter, and the two destructive-edge cases:
 * a DELETE without confirmation and a DELETE whose `before` date does not parse
 * (which must not degrade into "wipe everything").
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockDb, mockHandleApiError, mockRecordAuditEvent } = vi.hoisted(() => ({
  mockDb: {
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
  mockHandleApiError: vi.fn(),
  mockRecordAuditEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb, Prisma: {} }));

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
  requireAdmin: vi.fn((session: { user?: { role?: string } } | null) => session?.user?.role === "admin"),
  adminErrorResponse: vi.fn(
    () => new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }),
  ),
  authErrorResponse: vi.fn(
    () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
  ),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: { admin: { windowMs: 60_000, maxRequests: 60 } },
  getClientIp: () => "203.0.113.7",
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));

vi.mock("@/lib/utils", () => ({
  parsePagination: (searchParams: URLSearchParams, opts?: { defaultLimit?: number }) => {
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      opts?.defaultLimit ?? 20,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(opts?.defaultLimit ?? 20), 10) || 20),
    );
    return { page, limit, skip: (page - 1) * limit };
  },
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// The lib is exercised by its own suite; here it is stubbed so the route's
// contract (status codes, filters, confirmation) is what gets asserted.
vi.mock("@/lib/audit-log", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit-log")>("@/lib/audit-log");
  return {
    ...actual,
    recordAuditEvent: (...args: unknown[]) => mockRecordAuditEvent(...args),
    cleanupOldAuditLogs: vi.fn(async () => 0),
    listAuditLogs: vi.fn(),
    purgeAuditLogs: vi.fn(),
  };
});

import { getAuthSession } from "@/lib/auth";
import { listAuditLogs, purgeAuditLogs } from "@/lib/audit-log";
import { GET, DELETE } from "@/app/api/admin/audit-logs/route";

const adminSession = { user: { id: "admin-1", role: "admin", email: "admin@example.com", name: "Admin" } };
const studentSession = { user: { id: "student-1", role: "student" } };

function request(path: string, method = "GET") {
  return new NextRequest(`http://localhost${path}`, { method });
}

const EMPTY_PAGE = {
  entries: [],
  pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthSession).mockResolvedValue(adminSession as never);
  vi.mocked(listAuditLogs).mockResolvedValue(EMPTY_PAGE);
  vi.mocked(purgeAuditLogs).mockResolvedValue(0);
  mockRecordAuditEvent.mockResolvedValue(undefined);
  mockHandleApiError.mockReturnValue(
    new Response(JSON.stringify({ error: "internal" }), { status: 500 }),
  );
});

describe("GET /api/admin/audit-logs", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const res = await GET(request("/api/admin/audit-logs"));

    expect(res.status).toBe(401);
    expect(listAuditLogs).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-admin caller", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(studentSession as never);

    const res = await GET(request("/api/admin/audit-logs"));

    expect(res.status).toBe(403);
    expect(listAuditLogs).not.toHaveBeenCalled();
  });

  it("returns the page produced by the lib", async () => {
    const page = {
      entries: [
        {
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
          createdAt: "2026-01-02T03:04:05.000Z",
        },
      ],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    };
    vi.mocked(listAuditLogs).mockResolvedValue(page);

    const res = await GET(request("/api/admin/audit-logs"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(page);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("passes action, actor, entity and date filters through", async () => {
    await GET(
      request(
        "/api/admin/audit-logs?action=course.publish&actorId=admin-1&entityType=course&entityId=c1" +
          "&from=2026-01-01T00:00:00.000Z&to=2026-02-01T00:00:00.000Z",
      ),
    );

    const [filters] = vi.mocked(listAuditLogs).mock.calls[0];
    expect(filters.action).toBe("course.publish");
    expect(filters.actorId).toBe("admin-1");
    expect(filters.entityType).toBe("course");
    expect(filters.entityId).toBe("c1");
    expect(filters.from?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(filters.to?.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("rejects an action outside the catalogue instead of returning nothing", async () => {
    const res = await GET(request("/api/admin/audit-logs?action=course.nope"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Unknown audit action" });
    expect(listAuditLogs).not.toHaveBeenCalled();
  });

  it("trims and caps the search term, and drops a blank one", async () => {
    await GET(request(`/api/admin/audit-logs?search=${encodeURIComponent("  " + "a".repeat(200) + "  ")}`));
    expect(vi.mocked(listAuditLogs).mock.calls[0][0].search).toHaveLength(100);

    vi.mocked(listAuditLogs).mockClear();
    await GET(request("/api/admin/audit-logs?search=%20%20%20"));
    expect(vi.mocked(listAuditLogs).mock.calls[0][0].search).toBeNull();
  });

  it("ignores unparseable date filters rather than failing the request", async () => {
    const res = await GET(request("/api/admin/audit-logs?from=not-a-date"));

    expect(res.status).toBe(200);
    expect(vi.mocked(listAuditLogs).mock.calls[0][0].from).toBeNull();
  });

  it("maps a thrown error to the shared error handler", async () => {
    vi.mocked(listAuditLogs).mockRejectedValue(new Error("db down"));

    const res = await GET(request("/api/admin/audit-logs"));

    expect(res.status).toBe(500);
    expect(mockHandleApiError).toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/audit-logs", () => {
  it("returns 403 for a non-admin caller", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(studentSession as never);

    const res = await DELETE(request("/api/admin/audit-logs?confirm=true", "DELETE"));

    expect(res.status).toBe(403);
    expect(purgeAuditLogs).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation", async () => {
    const res = await DELETE(request("/api/admin/audit-logs", "DELETE"));

    expect(res.status).toBe(400);
    expect(purgeAuditLogs).not.toHaveBeenCalled();
  });

  it("rejects an unparseable `before` date instead of wiping everything", async () => {
    const res = await DELETE(request("/api/admin/audit-logs?confirm=true&before=garbage", "DELETE"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid `before` date" });
    expect(purgeAuditLogs).not.toHaveBeenCalled();
  });

  it("purges everything when no bound is given and records the purge", async () => {
    vi.mocked(purgeAuditLogs).mockResolvedValue(7);

    const res = await DELETE(request("/api/admin/audit-logs?confirm=true", "DELETE"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 7, before: null });
    expect(purgeAuditLogs).toHaveBeenCalledWith(null);
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "audit_log.purge",
        entityType: "audit_log",
        metadata: { deleted: 7, before: null },
      }),
    );
  });

  it("purges only entries older than `before`", async () => {
    vi.mocked(purgeAuditLogs).mockResolvedValue(3);

    const res = await DELETE(
      request("/api/admin/audit-logs?confirm=true&before=2026-03-01T00:00:00.000Z", "DELETE"),
    );

    expect(res.status).toBe(200);
    const cutoff = vi.mocked(purgeAuditLogs).mock.calls[0][0] as Date;
    expect(cutoff.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(await res.json()).toEqual({
      deleted: 3,
      before: "2026-03-01T00:00:00.000Z",
    });
  });
});
