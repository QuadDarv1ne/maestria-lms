// @vitest-environment node
/**
 * Unit tests for the canonical security-header set.
 *
 * The env module is mocked so the production-only branches (HSTS, CORS origin)
 * can be exercised deterministically instead of depending on NODE_ENV.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    siteUrl: "https://app.test",
    cdnUrl: "https://cdn.test/",
    s3Endpoint: "https://s3.test",
    isProduction: false,
  },
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  CSP_REQUIRED_DIRECTIVES,
  SECURITY_HEADER_VALUES,
} from "./security-headers";

beforeEach(() => {
  mockEnv.isProduction = false;
});

describe("buildSecurityHeaders", () => {
  it("applies the canonical header set to page routes", () => {
    const headers = buildSecurityHeaders("/courses");

    expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("no-referrer-when-downgrade");
    expect(headers["Permissions-Policy"]).toBe(SECURITY_HEADER_VALUES.permissionsPolicy);
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin-allow-popups");
    expect(headers["Cross-Origin-Resource-Policy"]).toBe("cross-origin");
    expect(headers["Content-Security-Policy"]).toBe(buildContentSecurityPolicy());
  });

  it("does not emit CORS headers for non-API routes", () => {
    const headers = buildSecurityHeaders("/courses");

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
  });

  it("pins application API CORS to the configured site origin", () => {
    const headers = buildSecurityHeaders("/api/courses");

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://app.test");
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST, PUT, DELETE, OPTIONS");
    expect(headers["Access-Control-Allow-Headers"]).toBe("Content-Type, Authorization");
  });

  it("treats health and auth discovery endpoints as fully public", () => {
    for (const pathname of [
      "/api/health",
      "/api/health/live",
      "/api/auth/csrf",
      "/api/auth/providers",
      "/api/auth/callback/credentials",
    ]) {
      expect(buildSecurityHeaders(pathname)["Access-Control-Allow-Origin"]).toBe("*");
    }
  });

  it("marks private areas as noindex", () => {
    for (const pathname of [
      "/profile",
      "/profile/settings",
      "/admin/users",
      "/notifications",
      "/achievements",
      "/status",
      "/payment/pay-1",
      "/teacher/courses",
    ]) {
      expect(buildSecurityHeaders(pathname)["X-Robots-Tag"]).toBe("noindex, nofollow");
    }
  });

  it("leaves public pages indexable", () => {
    for (const pathname of ["/", "/catalog", "/blog", "/course/python", "/about", "/help"]) {
      expect(buildSecurityHeaders(pathname)["X-Robots-Tag"]).toBeUndefined();
    }
  });
  it("omits HSTS outside production", () => {
    expect(buildSecurityHeaders("/")["Strict-Transport-Security"]).toBeUndefined();
  });

  it("emits HSTS in production", () => {
    mockEnv.isProduction = true;

    expect(buildSecurityHeaders("/")["Strict-Transport-Security"]).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
  });
});

describe("buildContentSecurityPolicy", () => {
  it("contains every required directive", () => {
    const csp = buildContentSecurityPolicy();

    for (const directive of CSP_REQUIRED_DIRECTIVES) {
      expect(csp).toContain(directive);
    }
  });

  it("contains the full directive set", () => {
    const csp = buildContentSecurityPolicy();

    for (const directive of [
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "media-src 'self' https:",
      "frame-src 'self' https://www.youtube.com https://player.vimeo.com https://ok.ru",
      "frame-ancestors 'self' https://www.youtube.com",
    ]) {
      expect(csp).toContain(directive);
    }
  });

  it("adds the configured CDN and S3 origins to connect-src", () => {
    const csp = buildContentSecurityPolicy();
    const connectSrc = csp.split("; ").find((part) => part.startsWith("connect-src"));

    expect(connectSrc).toContain("https://cdn.test");
    expect(connectSrc).toContain("https://s3.test");
    expect(connectSrc).toContain("'self'");
  });
});

describe("applySecurityHeaders", () => {
  it("writes the header set onto a response", () => {
    const response = NextResponse.next();
    applySecurityHeaders(response, "/api/health");

    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });

  it("keeps the documented values in one exported map", () => {
    expect(SECURITY_HEADER_VALUES.frameOptions).toBe("SAMEORIGIN");
    expect(SECURITY_HEADER_VALUES.contentTypeOptions).toBe("nosniff");
    expect(SECURITY_HEADER_VALUES.strictTransportSecurity).toContain("max-age=");
  });
});
