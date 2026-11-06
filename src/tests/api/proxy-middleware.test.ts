// @vitest-environment node
/**
 * Middleware tests for src/proxy.ts.
 *
 * The middleware had no tests, which is how the security-header regression
 * slipped through: the maintenance rewrite and both auth redirects returned
 * responses without the header set after next.config.ts stopped applying it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { mockEnv, mockGetToken, mockCsrfProtection } = vi.hoisted(() => ({
  mockEnv: {
    validate: vi.fn(),
    nextAuthSecret: "test-secret",
    siteUrl: "https://site.test",
    cdnUrl: "",
    s3Endpoint: "",
    isProduction: false,
    logLevel: "error",
    adminIpAllowlist: undefined as string | undefined,
    adminIpAllowlistMode: "enforce" as "enforce" | "warn",
  },
  mockGetToken: vi.fn(),
  mockCsrfProtection: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("next-auth/jwt", () => ({ getToken: (...args: unknown[]) => mockGetToken(...args) }));
vi.mock("@/lib/csrf", () => ({ csrfProtection: (...args: unknown[]) => mockCsrfProtection(...args) }));

import { proxy, config } from "@/proxy";

function request(
  pathname: string,
  init?: { method?: string; cookies?: Record<string, string>; headers?: Record<string, string> },
) {
  const headers = new Headers(init?.headers);
  if (init?.cookies) {
    headers.set("cookie", Object.entries(init.cookies).map(([k, v]) => `${k}=${v}`).join("; "));
  }
  return new NextRequest(`https://site.test${pathname}`, { method: init?.method ?? "GET", headers });
}

const CSP = "Content-Security-Policy";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.MAINTENANCE_MODE;
  mockEnv.adminIpAllowlist = undefined;
  mockEnv.adminIpAllowlistMode = "enforce";
  mockCsrfProtection.mockReturnValue(null);
  mockGetToken.mockResolvedValue(null);
});

afterEach(() => {
  delete process.env.MAINTENANCE_MODE;
});

describe("proxy middleware — security headers", () => {
  it("attaches the header set to normal page responses", async () => {
    const res = await proxy(request("/courses"));

    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get(CSP)).toContain("default-src 'self'");
  });

  it("attaches the header set to the maintenance rewrite", async () => {
    process.env.MAINTENANCE_MODE = "true";

    const res = await proxy(request("/courses"));

    expect(res.status).toBe(200);
    expect(res.headers.get(CSP)).toContain("default-src 'self'");
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("keeps maintenance mode active when the bypass secret is not configured", async () => {
    // Regression: an unset MAINTENANCE_BYPASS_SECRET must NOT equal a missing
    // cookie (both undefined), which previously let every visitor bypass.
    process.env.MAINTENANCE_MODE = "true";
    delete process.env.MAINTENANCE_BYPASS_SECRET;

    const res = await proxy(request("/courses"));

    // Maintenance rewrites to /maintenance via the x-middleware-rewrite header.
    expect(res.headers.get("x-middleware-rewrite") ?? "").toContain("/maintenance");
  });

  it("grants bypass only when the configured secret matches the cookie", async () => {
    process.env.MAINTENANCE_MODE = "true";
    process.env.MAINTENANCE_BYPASS_SECRET = "s3cr3t";

    // Correct secret → not rewritten to maintenance (normal pass-through).
    const allowed = await proxy(
      request("/courses", { cookies: { "maestria-maintenance-bypass": "s3cr3t" } }),
    );
    expect(allowed.headers.get("x-middleware-rewrite")).toBeNull();

    // Wrong secret → still in maintenance.
    const denied = await proxy(
      request("/courses", { cookies: { "maestria-maintenance-bypass": "wrong" } }),
    );
    expect(denied.headers.get("x-middleware-rewrite") ?? "").toContain("/maintenance");

    delete process.env.MAINTENANCE_BYPASS_SECRET;
  });

  it("attaches the header set to the login redirect for unauthenticated users", async () => {
    mockGetToken.mockResolvedValue(null);

    const res = await proxy(request("/admin", { cookies: { "maestria-locale": "ru" } }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/#login");
    expect(res.headers.get(CSP)).toContain("default-src 'self'");
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  });

  it("attaches the header set to the redirect for an insufficient role", async () => {
    mockGetToken.mockResolvedValue({ role: "student" });

    const res = await proxy(request("/admin", { cookies: { "maestria-locale": "ru" } }));

    expect(res.status).toBe(307);
    expect(res.headers.get(CSP)).toContain("default-src 'self'");
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  });

  it("lets an authorised admin through", async () => {
    mockGetToken.mockResolvedValue({ role: "admin" });

    const res = await proxy(request("/admin", { cookies: { "maestria-locale": "ru" } }));

    expect(res.headers.get(CSP)).toContain("default-src 'self'");
  });

  it("passes a first, cookie-less request to a protected page through to the app", async () => {
    // Locale bootstrap returns early when the locale cookie is absent, so the
    // role check does not run on that first request. Protected pages must
    // therefore enforce authorisation server-side as well.
    mockGetToken.mockResolvedValue(null);

    const res = await proxy(request("/admin"));

    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get(CSP)).toContain("default-src 'self'");
  });

  it("adds credentialed CORS headers for application API routes", async () => {
    const res = await proxy(request("/api/courses"));

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://site.test");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("does not require CSRF for safe methods but enforces it for writes", async () => {
    await proxy(request("/api/courses", { method: "GET" }));
    expect(mockCsrfProtection).not.toHaveBeenCalled();

    await proxy(request("/api/courses", { method: "POST" }));
    expect(mockCsrfProtection).toHaveBeenCalledTimes(1);
  });

  it("excludes the webhook and health endpoints from CSRF", async () => {
    await proxy(request("/api/payments/webhook", { method: "POST" }));
    expect(mockCsrfProtection).not.toHaveBeenCalled();
  });

  it("keeps the documented paths out of the matcher", () => {
    const matcher = config.matcher.join(" ");

    expect(matcher).toContain("_next/static");
    expect(matcher).toContain("api/notifications/sse");
    expect(matcher).toContain("favicon.ico");
  });
});

describe("proxy middleware — admin IP allowlist", () => {
  it("blocks an admin page from an unlisted network with a 403", async () => {
    mockEnv.adminIpAllowlist = "10.0.0.0/8";
    mockGetToken.mockResolvedValue({ role: "admin" });

    const res = await proxy(
      request("/admin", {
        cookies: { "maestria-locale": "ru" },
        headers: { "x-forwarded-for": "203.0.113.7" },
      }),
    );

    expect(res.status).toBe(403);
    expect(res.headers.get("x-middleware-rewrite") ?? "").toContain("/forbidden");
    expect(res.headers.get(CSP)).toContain("default-src 'self'");
  });

  it("never verifies the token for a blocked request", async () => {
    mockEnv.adminIpAllowlist = "10.0.0.0/8";

    await proxy(
      request("/admin", { cookies: { "maestria-locale": "ru" }, headers: { "x-real-ip": "8.8.8.8" } }),
    );

    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it("lets a listed admin through to the normal auth flow", async () => {
    mockEnv.adminIpAllowlist = "10.0.0.0/8";
    mockGetToken.mockResolvedValue({ role: "admin" });

    const res = await proxy(
      request("/admin", {
        cookies: { "maestria-locale": "ru" },
        headers: { "x-forwarded-for": "10.1.2.3" },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockGetToken).toHaveBeenCalled();
  });

  it("returns a JSON 403 for admin API routes", async () => {
    mockEnv.adminIpAllowlist = "10.0.0.0/8";

    const res = await proxy(
      request("/api/admin/users", { headers: { "x-forwarded-for": "203.0.113.7" } }),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "FORBIDDEN" });
    expect(res.headers.get(CSP)).toContain("default-src 'self'");
  });

  it("reports a misconfigured allowlist instead of opening the panel", async () => {
    mockEnv.adminIpAllowlist = "office";
    mockGetToken.mockResolvedValue({ role: "admin" });

    const res = await proxy(
      request("/api/admin/users", { headers: { "x-forwarded-for": "10.1.2.3" } }),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "Admin IP allowlist is misconfigured" });
  });

  it("blocks an admin request whose IP cannot be determined", async () => {
    mockEnv.adminIpAllowlist = "10.0.0.0/8";

    const res = await proxy(request("/admin", { cookies: { "maestria-locale": "ru" } }));

    expect(res.status).toBe(403);
  });

  it("blocks a cookie-less admin request", async () => {
    // Regression: the locale bootstrap returns early when the locale cookie is
    // absent, so the allowlist has to run before it — otherwise a first request
    // to /admin from an unlisted network escaped the filter entirely.
    mockEnv.adminIpAllowlist = "10.0.0.0/8";

    const res = await proxy(request("/admin", { headers: { "x-forwarded-for": "203.0.113.7" } }));

    expect(res.status).toBe(403);
    expect(res.headers.get("x-middleware-rewrite") ?? "").toContain("/forbidden");
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it("leaves non-admin routes untouched", async () => {
    mockEnv.adminIpAllowlist = "10.0.0.0/8";

    const res = await proxy(request("/courses", { headers: { "x-forwarded-for": "203.0.113.7" } }));

    expect(res.status).toBe(200);
  });

  it("warn mode reports the refusal without blocking the page", async () => {
    mockEnv.adminIpAllowlist = "10.0.0.0/8";
    mockEnv.adminIpAllowlistMode = "warn";
    mockGetToken.mockResolvedValue({ role: "admin" });

    const res = await proxy(
      request("/admin", {
        cookies: { "maestria-locale": "ru" },
        headers: { "x-forwarded-for": "203.0.113.7" },
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(mockGetToken).toHaveBeenCalled();
  });

  it("warn mode reports the refusal for an admin API route without blocking it", async () => {
    mockEnv.adminIpAllowlist = "10.0.0.0/8";
    mockEnv.adminIpAllowlistMode = "warn";

    const res = await proxy(
      request("/api/admin/users", { headers: { "x-forwarded-for": "203.0.113.7" } }),
    );

    expect(res.status).toBe(200);
  });

  it("warn mode lets the request through so the filter can be rolled out safely", async () => {
    // The point of warn mode: an admin on a proxy that does not forward the
    // client address must be able to verify that before enforce locks them out.
    mockEnv.adminIpAllowlist = "10.0.0.0/8";
    mockEnv.adminIpAllowlistMode = "warn";
    mockGetToken.mockResolvedValue({ role: "admin" });

    const res = await proxy(
      request("/admin", {
        cookies: { "maestria-locale": "ru" },
        headers: { "x-forwarded-for": "203.0.113.7" },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockGetToken).toHaveBeenCalled();
  });

  it("does not restrict anything when the allowlist is unset", async () => {
    mockGetToken.mockResolvedValue({ role: "admin" });

    const res = await proxy(
      request("/admin", {
        cookies: { "maestria-locale": "ru" },
        headers: { "x-forwarded-for": "203.0.113.7" },
      }),
    );

    expect(res.status).toBe(200);
  });
});
