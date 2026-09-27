// @vitest-environment node
/**
 * Route-level tests for the admin API — authorisation and aggregation logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockDb, mockHandleApiError } = vi.hoisted(() => ({
  mockDb: {
    user: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    course: { aggregate: vi.fn(), count: vi.fn() },
    enrollment: { aggregate: vi.fn() },
    payment: { aggregate: vi.fn() },
    progress: { groupBy: vi.fn() },
  },
  mockHandleApiError: vi.fn(),
}));

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

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: { admin: { windowMs: 60_000, maxRequests: 60 } },
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));

vi.mock("@/lib/utils", () => ({
  parsePagination: (_searchParams: URLSearchParams, opts?: { defaultLimit?: number }) => ({
    page: 1,
    limit: opts?.defaultLimit ?? 20,
    skip: 0,
  }),
}));

import { getAuthSession } from "@/lib/auth";
import { GET as getStats } from "@/app/api/admin/stats/route";
import { GET as getUsers } from "@/app/api/admin/users/route";

const adminSession = { user: { id: "admin-1", role: "admin" } };
const studentSession = { user: { id: "student-1", role: "student" } };

function request(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthSession).mockResolvedValue(adminSession as never);
  mockDb.user.groupBy.mockResolvedValue([
    { role: "student", _count: 10 },
    { role: "teacher", _count: 3 },
    { role: "admin", _count: 2 },
  ]);
  mockDb.course.aggregate.mockResolvedValue({ _count: 7, _sum: { price: 100000 } });
  mockDb.course.count.mockResolvedValue(5);
  mockDb.enrollment.aggregate.mockResolvedValue({ _count: 42 });
  mockDb.payment.aggregate.mockResolvedValue({ _sum: { amount: 250000 }, _count: 17 });
  mockDb.progress.groupBy.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);
  mockDb.user.findMany.mockResolvedValue([]);
  mockDb.user.count.mockResolvedValue(0);
  mockHandleApiError.mockReturnValue(new Response(JSON.stringify({ error: "internal" }), { status: 500 }));
});

describe("GET /api/admin/stats", () => {
  it("rejects an unauthenticated caller", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const res = await getStats(request("/api/admin/stats"));
    expect(res.status).toBe(403);
    expect(mockDb.user.groupBy).not.toHaveBeenCalled();
  });

  it("rejects a non-admin user", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(studentSession as never);

    const res = await getStats(request("/api/admin/stats"));
    expect(res.status).toBe(403);
    expect(mockDb.user.groupBy).not.toHaveBeenCalled();
  });

  it("computes the dashboard totals for an admin", async () => {
    const res = await getStats(request("/api/admin/stats"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totalUsers).toBe(15);
    expect(body.totalStudents).toBe(10);
    expect(body.totalTeachers).toBe(3);
    expect(body.totalAdmins).toBe(2);
    expect(body.totalRevenue).toBe(250000);
    expect(body.totalPayments).toBe(17);
    expect(body.totalEnrollments).toBe(42);
    expect(body.activeToday).toBe(2);
    expect(body.dbSize).toBe("PostgreSQL");
  });

  it("treats a missing revenue aggregate as zero", async () => {
    mockDb.payment.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 });

    const res = await getStats(request("/api/admin/stats"));
    const body = await res.json();
    expect(body.totalRevenue).toBe(0);
  });

  it("routes database failures through handleApiError", async () => {
    mockDb.user.groupBy.mockRejectedValue(new Error("db down"));

    const res = await getStats(request("/api/admin/stats"));
    expect(res.status).toBe(500);
    expect(mockHandleApiError).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/admin/users", () => {
  it("rejects a non-admin user", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(studentSession as never);

    const res = await getUsers(request("/api/admin/users"));
    expect(res.status).toBe(403);
    expect(mockDb.user.findMany).not.toHaveBeenCalled();
  });

  it("returns a paginated list for an admin", async () => {
    mockDb.user.findMany.mockResolvedValue([{ id: "u1", email: "a@b.c", name: "A" }]);
    mockDb.user.count.mockResolvedValue(1);

    const res = await getUsers(request("/api/admin/users"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.users).toHaveLength(1);
    expect(body.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it("ignores a role filter that is not in the allow-list", async () => {
    await getUsers(request("/api/admin/users?role=superuser"));

    const args = mockDb.user.findMany.mock.calls[0][0];
    expect(args.where.role).toBeUndefined();
  });

  it("applies an allow-listed role filter", async () => {
    await getUsers(request("/api/admin/users?role=teacher"));

    const args = mockDb.user.findMany.mock.calls[0][0];
    expect(args.where.role).toBe("teacher");
  });

  it("uses a case-insensitive search filter on PostgreSQL", async () => {
    await getUsers(request("/api/admin/users?search=anna"));

    const args = mockDb.user.findMany.mock.calls[0][0];
    expect(args.where.OR).toHaveLength(2);
    expect(args.where.OR[0].name.mode).toBe("insensitive");
  });

  it("ignores an over-long search term", async () => {
    await getUsers(request(`/api/admin/users?search=${"a".repeat(150)}`));

    const args = mockDb.user.findMany.mock.calls[0][0];
    expect(args.where.OR).toBeUndefined();
  });
});
