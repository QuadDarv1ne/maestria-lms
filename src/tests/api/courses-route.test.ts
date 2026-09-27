// @vitest-environment node
/**
 * Route-level tests for GET /api/courses (public catalog list).
 *
 * These invoke the real handler with a constructed NextRequest; only the
 * infrastructure modules (db, cache, rate limit, logger, error mapper) are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockDb, mockCacheGet, mockHandleApiError } = vi.hoisted(() => ({
  mockDb: {
    course: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    category: { findUnique: vi.fn() },
  },
  mockCacheGet: vi.fn(),
  mockHandleApiError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
  Prisma: { SortOrder: { asc: "asc", desc: "desc" } },
  getDatabaseProvider: () => "sqlite",
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: { default: { windowMs: 60_000, maxRequests: 30 } },
}));

vi.mock("@/lib/cache", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: vi.fn().mockResolvedValue(true),
  generateCacheKey: (prefix: string, params: unknown) => `${prefix}:${JSON.stringify(params)}`,
  createCacheHeaders: () => ({ "Cache-Control": "public, max-age=300" }),
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));

vi.mock("@/lib/utils", () => ({
  parsePagination: (_searchParams: URLSearchParams, opts?: { defaultLimit?: number }) => ({
    page: 1,
    limit: opts?.defaultLimit ?? 12,
    skip: 0,
  }),
}));

import { GET } from "@/app/api/courses/route";

const courseRow = {
  id: "course-1",
  title: "Python с нуля",
  slug: "python",
  description: "Описание",
  shortDesc: "Коротко",
  image: null,
  price: 0,
  oldPrice: null,
  currency: "RUB",
  level: "beginner",
  duration: 10,
  language: "ru",
  isFeatured: false,
  hasCertificate: true,
  rating: 4.5,
  tags: ["python"],
  teacher: { id: "teacher-1", name: "Преподаватель", image: null },
  category: { id: "cat-1", name: "IT", slug: "it", icon: null, color: null },
  modules: [
    { id: "m1", lessons: [{ id: "l1", duration: 30 }, { id: "l2", duration: 45 }] },
    { id: "m2", lessons: [{ id: "l3", duration: 15 }] },
  ],
  _count: { enrollments: 7, reviews: 3 },
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

function coursesRequest(query = "") {
  return new NextRequest(`http://localhost/api/courses${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCacheGet.mockResolvedValue(null);
  mockDb.course.findMany.mockResolvedValue([courseRow]);
  mockDb.course.count.mockResolvedValue(1);
  mockDb.course.findUnique.mockResolvedValue(null);
  mockDb.category.findUnique.mockResolvedValue(null);
  mockHandleApiError.mockReturnValue(new Response(JSON.stringify({ error: "internal" }), { status: 500 }));
});

describe("GET /api/courses", () => {
  it("returns published courses with computed lesson and duration totals", async () => {
    const res = await GET(coursesRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.pagination).toEqual({ page: 1, limit: 12, total: 1, totalPages: 1 });
    expect(body.courses).toHaveLength(1);

    const course = body.courses[0];
    expect(course.totalLessons).toBe(3);
    expect(course.totalDuration).toBe(90);
    expect(course.modulesCount).toBe(2);
    expect(course.studentCount).toBe(7);
    expect(course.reviewCount).toBe(3);
    expect(res.headers.get("X-Cache")).toBe("MISS");
  });

  it("filters by published flag and never leaks unpublished courses", async () => {
    await GET(coursesRequest());
    const args = mockDb.course.findMany.mock.calls[0][0];
    expect(args.where.isPublished).toBe(true);
  });

  it("serves the lightweight ids lookup branch", async () => {
    mockDb.course.findMany.mockResolvedValue([
      { id: "course-1", title: "Python с нуля", slug: "python" },
    ]);

    const res = await GET(coursesRequest("?ids=course-1,course-2"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.courses).toHaveLength(1);
    const args = mockDb.course.findMany.mock.calls[0][0];
    expect(args.select).toEqual({ id: true, title: true, slug: true });
    expect(args.where.id.in).toEqual(["course-1", "course-2"]);
  });

  it("returns the cached payload with an X-Cache HIT header", async () => {
    const cached = {
      courses: [],
      pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
    };
    mockCacheGet.mockResolvedValue(cached);

    const res = await GET(coursesRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("HIT");
    expect(await res.json()).toEqual(cached);
    expect(mockDb.course.findMany).not.toHaveBeenCalled();
  });

  it("rejects an invalid level filter with 400", async () => {
    const res = await GET(coursesRequest("?level=godlike"));
    expect(res.status).toBe(400);
    expect(mockDb.course.findMany).not.toHaveBeenCalled();
  });

  it("routes unexpected database failures through handleApiError", async () => {
    mockDb.course.findMany.mockRejectedValue(new Error("db down"));

    const res = await GET(coursesRequest());
    expect(res.status).toBe(500);
    expect(mockHandleApiError).toHaveBeenCalledTimes(1);
  });
});
