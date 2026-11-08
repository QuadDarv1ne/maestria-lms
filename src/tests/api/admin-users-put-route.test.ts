// @vitest-environment node
/**
 * Route-level tests for PUT /api/admin/users.
 *
 * The route is the only way to change someone's role or block them, so the
 * tests pin down the guard that keeps the platform manageable: the last active
 * administrator cannot be demoted or blocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockDb, mockRecordAuditEvent, mockInvalidateJwtUserCache, mockHandleApiError } = vi.hoisted(
  () => ({
    mockDb: {
      user: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    },
    mockRecordAuditEvent: vi.fn(),
    mockInvalidateJwtUserCache: vi.fn(),
    mockHandleApiError: vi.fn(),
  }),
);

vi.mock("@/lib/db", () => ({
  db: mockDb,
  Prisma: {},
  getDatabaseProvider: () => "postgresql",
}));

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
  requireAdmin: vi.fn((session: { user?: { role?: string } } | null) => session?.user?.role === "admin"),
  adminErrorResponse: vi.fn(
    () => new Response(JSON.stringify({ error: "Доступ запрещён" }), { status: 403 }),
  ),
}));

vi.mock("@/lib/jwt-user-cache", () => ({
  invalidateJwtUserCache: (...args: unknown[]) => mockInvalidateJwtUserCache(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: { admin: { windowMs: 60_000, maxRequests: 60 } },
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));

vi.mock("@/lib/audit-log", () => ({
  AUDIT_ACTIONS: {
    userRoleChange: "user.role_change",
    userStatusChange: "user.status_change",
    userUpdate: "user.update",
  },
  auditActorFromSession: vi.fn(() => ({ id: "admin-1" })),
  recordAuditEvent: (...args: unknown[]) => mockRecordAuditEvent(...args),
}));

vi.mock("@/lib/utils", () => ({
  parsePagination: () => ({ page: 1, limit: 20, skip: 0 }),
}));

import { getAuthSession } from "@/lib/auth";
import { PUT } from "@/app/api/admin/users/route";

const ADMIN_ID = "admin-1";
const TARGET_ID = "admin-2";

function putRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/users", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthSession).mockResolvedValue({
    user: { id: ADMIN_ID, role: "admin" },
  } as never);
  mockDb.user.findUnique.mockResolvedValue({
    role: "admin",
    isActive: true,
    name: "Second Admin",
    email: "admin2@example.com",
  });
  mockDb.user.update.mockResolvedValue({
    id: TARGET_ID,
    email: "admin2@example.com",
    name: "Second Admin",
    role: "student",
    isActive: true,
    image: null,
  });
  // No other active admin besides the target.
  mockDb.user.count.mockResolvedValue(0);
  mockHandleApiError.mockReturnValue(
    new Response(JSON.stringify({ error: "internal" }), { status: 500 }),
  );
});

describe("PUT /api/admin/users — last admin protection", () => {
  it("refuses to demote the last active admin", async () => {
    const res = await PUT(putRequest({ userId: TARGET_ID, role: "student" }));

    expect(res.status).toBe(409);
    expect(mockDb.user.update).not.toHaveBeenCalled();
    expect(mockRecordAuditEvent).not.toHaveBeenCalled();
    expect(mockInvalidateJwtUserCache).not.toHaveBeenCalled();
  });

  it("refuses to block the last active admin", async () => {
    const res = await PUT(putRequest({ userId: TARGET_ID, isActive: false }));

    expect(res.status).toBe(409);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("demotes an admin when another active admin remains", async () => {
    mockDb.user.count.mockResolvedValue(1);

    const res = await PUT(putRequest({ userId: TARGET_ID, role: "student" }));

    expect(res.status).toBe(200);
    expect(mockDb.user.count).toHaveBeenCalledWith({
      where: { role: "admin", isActive: true, id: { not: TARGET_ID } },
    });
    expect(mockDb.user.update).toHaveBeenCalledTimes(1);
  });

  it("does not consult the admin count when the target is not an admin", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      role: "student",
      isActive: true,
      name: "Student",
      email: "student@example.com",
    });

    const res = await PUT(putRequest({ userId: TARGET_ID, isActive: false }));

    expect(res.status).toBe(200);
    expect(mockDb.user.count).not.toHaveBeenCalled();
  });

  it("allows renaming the last admin", async () => {
    const res = await PUT(putRequest({ userId: TARGET_ID, name: "Renamed" }));

    expect(res.status).toBe(200);
    expect(mockDb.user.count).not.toHaveBeenCalled();
  });

  it("returns 404 for a user that does not exist", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    const res = await PUT(putRequest({ userId: TARGET_ID, role: "student" }));

    expect(res.status).toBe(404);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });
});

describe("PUT /api/admin/users — cache invalidation", () => {
  it("drops the cached role after a role change", async () => {
    mockDb.user.count.mockResolvedValue(1);

    await PUT(putRequest({ userId: TARGET_ID, role: "student" }));

    expect(mockInvalidateJwtUserCache).toHaveBeenCalledWith(TARGET_ID);
  });

  it("drops the cached status after a block", async () => {
    mockDb.user.count.mockResolvedValue(1);

    await PUT(putRequest({ userId: TARGET_ID, isActive: false }));

    expect(mockInvalidateJwtUserCache).toHaveBeenCalledWith(TARGET_ID);
  });

  it("keeps the cache when only the name changed", async () => {
    await PUT(putRequest({ userId: TARGET_ID, name: "Renamed" }));

    expect(mockInvalidateJwtUserCache).not.toHaveBeenCalled();
  });
});

describe("PUT /api/admin/users — self-protection", () => {
  it("refuses to demote the calling admin", async () => {
    const res = await PUT(putRequest({ userId: ADMIN_ID, role: "student" }));

    expect(res.status).toBe(400);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("refuses to block the calling admin", async () => {
    const res = await PUT(putRequest({ userId: ADMIN_ID, isActive: false }));

    expect(res.status).toBe(400);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });
});
