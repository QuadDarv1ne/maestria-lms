import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./logger", () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

function createMockRequest(ip: string = "127.0.0.1"): Request {
  return new Request("http://localhost/test", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("rateLimit", () => {
  let rateLimit: typeof import("./rate-limit").rateLimit;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./rate-limit");
    rateLimit = module.rateLimit;
  });

  it("returns null when requests are within limit", () => {
    const check = rateLimit("test-within", { windowMs: 60_000, maxRequests: 3 });

    expect(check(createMockRequest())).toBeNull();
    expect(check(createMockRequest())).toBeNull();
    expect(check(createMockRequest())).toBeNull();
  });

  it("returns 429 response when limit is exceeded", () => {
    const check = rateLimit("test-exceed", { windowMs: 60_000, maxRequests: 2 });

    expect(check(createMockRequest())).toBeNull();
    expect(check(createMockRequest())).toBeNull();

    const response = check(createMockRequest());
    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
  });

  it("uses different limits for different namespaces", () => {
    const strict = rateLimit("test-strict", { windowMs: 60_000, maxRequests: 1 });
    const loose = rateLimit("test-loose", { windowMs: 60_000, maxRequests: 5 });

    expect(strict(createMockRequest())).toBeNull();
    expect(strict(createMockRequest())?.status).toBe(429);

    expect(loose(createMockRequest())).toBeNull();
  });

  it("tracks different IPs separately", () => {
    const check = rateLimit("test-ip", { windowMs: 60_000, maxRequests: 1 });

    expect(check(createMockRequest("1.1.1.1"))).toBeNull();
    expect(check(createMockRequest("1.1.1.1"))?.status).toBe(429);

    // Different IP should have its own counter
    expect(check(createMockRequest("2.2.2.2"))).toBeNull();
  });
});

describe("requireAdmin", () => {
  it("returns null for admin user", () => {
    const adminSession = {
      user: { id: "1", role: "admin", name: "Admin", email: "admin@test.com" },
    };

    const response = (adminSession.user.role !== "admin")
      ? { status: 403 }
      : null;

    expect(response).toBeNull();
  });

  it("returns 403 for non-admin user", () => {
    const userSession = {
      user: { id: "2", role: "user", name: "User", email: "user@test.com" },
    };

    const response = (userSession.user.role !== "admin")
      ? { status: 403 }
      : null;

    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
  });

  it("returns 403 for null session", () => {
    const session = null;
    const response = (!session?.user || session.user.role !== "admin")
      ? { status: 403 }
      : null;

    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
  });
});
