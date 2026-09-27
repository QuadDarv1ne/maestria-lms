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
  },
  mockGetToken: vi.fn(),
  mockCsrfProtection: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("next-auth/jwt", () => ({ getToken: (...args: unknown[]) => mockGetToken(...args) }));
vi.mock("@/lib/csrf", () => ({ csrfProtection: (...args: unknown[]) => mockCsrfProtection(...args) }));

import { proxy, config } from "@/proxy";

function request(pathname: string, init?: { method?: string; cookies?: Record<string, string> }) {
  const headers = new Headers();
  if (init?.cookies) {
    headers.set("cookie", Object.entries(init.cookies).map(([k, v]) => `${k}=${v}`).join("; "));
  }
  return new NextRequest(`https://site.test${pathname}`, { method: init?.method ?? "GET", headers });
}

const CSP = "Content-Security-Policy";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.MAINTENANCE_MODE;
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
