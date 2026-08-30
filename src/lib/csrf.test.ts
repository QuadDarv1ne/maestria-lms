/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { csrfProtection } from "@/lib/csrf";

function makeRequest(method: string, origin: string | null, host: string | null): NextRequest {
  const headers = new Headers();
  if (origin !== null) headers.set("origin", origin);
  if (host !== null) headers.set("host", host);
  const request = new NextRequest(new URL("https://example.com/api/courses"), {
    method,
    headers,
  });
  return request;
}

describe("csrfProtection", () => {
  it("should allow safe methods (GET/HEAD/OPTIONS) without validation", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const result = csrfProtection(makeRequest(method, "https://evil.com", "example.com"));
      expect(result).toBeNull();
    }
  });

  it("should allow mutation when Origin matches Host", () => {
    const result = csrfProtection(makeRequest("POST", "https://example.com", "example.com"));
    expect(result).toBeNull();
  });

  it("should block mutation when Origin host differs from Host", () => {
    const result = csrfProtection(makeRequest("POST", "https://evil.com", "example.com"));
    expect(result).not.toBeNull();
    if (result) expect(result.status).toBe(403);
  });

  it("should allow mutation when Origin header is absent (SameSite=Strict sole defence)", () => {
    const result = csrfProtection(makeRequest("POST", null, "example.com"));
    expect(result).toBeNull();
  });

  it("should allow mutation when Host header is absent", () => {
    const result = csrfProtection(makeRequest("POST", "https://example.com", null));
    expect(result).toBeNull();
  });

  it("should allow when Origin matches Host including non-443 port", () => {
    const result = csrfProtection(makeRequest("PATCH", "https://example.com:3000", "example.com:3000"));
    expect(result).toBeNull();
  });

  it("should reject when Origin matches Host port but Host without port", () => {
    const result = csrfProtection(makeRequest("DELETE", "https://example.com:3000", "example.com"));
    expect(result).not.toBeNull();
    if (result) expect(result.status).toBe(403);
  });

  it("should reject malformed Origin URL", () => {
    const result = csrfProtection(makeRequest("POST", "not a url", "example.com"));
    expect(result).not.toBeNull();
    if (result) expect(result.status).toBe(403);
  });
});
