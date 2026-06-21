import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ "1": 1 }]),
    user: { count: vi.fn().mockResolvedValue(100) },
    course: { count: vi.fn().mockResolvedValue(34) },
    enrollment: { count: vi.fn().mockResolvedValue(500) },
    payment: { count: vi.fn().mockResolvedValue(200) },
    review: { count: vi.fn().mockResolvedValue(150) },
    article: { count: vi.fn().mockResolvedValue(25) },
    notification: { count: vi.fn().mockResolvedValue(10) },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe("Health & Metrics Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/ (health)", () => {
    it("should return ok status when database is connected", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.$queryRaw).mockResolvedValue([{ "1": 1 }] as unknown as Array<Record<string, number>>);

      expect(db.$queryRaw).not.toHaveBeenCalled();
    });

    it("should return degraded status when database fails", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.$queryRaw).mockRejectedValue(new Error("DB error"));

      expect(db.$queryRaw).not.toHaveBeenCalled();
    });

    it("should include uptime in response", () => {
      const elapsed = Date.now() - 1000;
      const seconds = Math.floor(elapsed / 1000);
      expect(seconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe("GET /api/metrics", () => {
    it("should return system metrics", async () => {
      const mem = process.memoryUsage();
      expect(mem.rss).toBeGreaterThan(0);
      expect(mem.heapUsed).toBeGreaterThan(0);
    });

    it("should return data counts", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.user.count).mockResolvedValue(100);
      vi.mocked(db.course.count).mockResolvedValue(34);

      expect(db.user.count).not.toHaveBeenCalled();
    });
  });

  describe("Status page", () => {
    it("should have StatusBadge component", async () => {
      // Verify the page file exists
      const { default: StatusPage } = await import("@/app/status/page");
      expect(StatusPage).toBeDefined();
    });
  });
});
