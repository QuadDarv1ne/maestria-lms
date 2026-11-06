// @vitest-environment node
/**
 * Route-level tests for GET /api/certificates/verify (public certificate verification).
 *
 * The endpoint is unauthenticated and returns a graduate's name, so the tests
 * pin down the input normalization (trim + upper-case), the 400/404 contract
 * and the exact shape of the public payload.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockDb, mockHandleApiError } = vi.hoisted(() => ({
  mockDb: {
    certificate: { findUnique: vi.fn() },
  },
  mockHandleApiError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: { certificateVerify: {} },
}));
vi.mock("@/lib/api-errors", () => ({
  handleApiError: () => mockHandleApiError(),
}));
vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { GET } from "@/app/api/certificates/verify/route";

const ISSUED_AT = "2026-06-15T10:00:00.000Z";

function certificateRecord(overrides: Record<string, unknown> = {}) {
  return {
    certificateNumber: "MAE-2026-ABC12345",
    issuedAt: new Date(ISSUED_AT),
    user: { name: "Ivan Petrov", email: "ivan@example.com" },
    course: { title: "Advanced TypeScript", slug: "advanced-typescript" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.certificate.findUnique.mockResolvedValue(null);
  mockHandleApiError.mockReturnValue(
    new Response(JSON.stringify({ error: "internal" }), { status: 500 }),
  );
});

describe("GET /api/certificates/verify", () => {
  it("returns 400 when the number parameter is missing", async () => {
    const response = await GET(new NextRequest("http://localhost/api/certificates/verify"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Certificate number is required" });
    expect(mockDb.certificate.findUnique).not.toHaveBeenCalled();
  });

  it("returns 400 when the number parameter is only whitespace", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/certificates/verify?number=%20%20"),
    );

    expect(response.status).toBe(400);
    expect(mockDb.certificate.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown certificate number", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/certificates/verify?number=MAE-2026-FAKE1234"),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Certificate not found" });
  });

  it("returns the public payload for a valid number and looks it up case-insensitively", async () => {
    mockDb.certificate.findUnique.mockResolvedValue(certificateRecord());

    const response = await GET(
      new NextRequest("http://localhost/api/certificates/verify?number=mae-2026-abc12345"),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.valid).toBe(true);
    // issuedAt goes through JSON, so it arrives as an ISO string
    expect(json.certificate).toEqual({
      number: "MAE-2026-ABC12345",
      issuedAt: ISSUED_AT,
      userName: "Ivan Petrov",
      courseTitle: "Advanced TypeScript",
      courseSlug: "advanced-typescript",
    });

    expect(mockDb.certificate.findUnique).toHaveBeenCalledWith({
      where: { certificateNumber: "MAE-2026-ABC12345" },
      select: {
        certificateNumber: true,
        issuedAt: true,
        user: { select: { name: true, email: true } },
        course: { select: { title: true, slug: true } },
      },
    });
  });

  it("trims surrounding whitespace before the lookup", async () => {
    mockDb.certificate.findUnique.mockResolvedValue(certificateRecord());

    const response = await GET(
      new NextRequest("http://localhost/api/certificates/verify?number=%20%20MAE-2026-ABC12345%20%20"),
    );

    expect(response.status).toBe(200);
    expect(mockDb.certificate.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { certificateNumber: "MAE-2026-ABC12345" } }),
    );
  });

  it("falls back to the email when the graduate has no name", async () => {
    mockDb.certificate.findUnique.mockResolvedValue(
      certificateRecord({ user: { name: null, email: "nobody@test.com" } }),
    );

    const response = await GET(
      new NextRequest("http://localhost/api/certificates/verify?number=MAE-2026-ABC12345"),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.certificate.userName).toBe("nobody@test.com");
  });

  it("prefers the name over the email when both are set", async () => {
    mockDb.certificate.findUnique.mockResolvedValue(
      certificateRecord({ user: { name: "Maria Ivanova", email: "maria@test.com" } }),
    );

    const response = await GET(
      new NextRequest("http://localhost/api/certificates/verify?number=MAE-2026-ABC12345"),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.certificate.userName).toBe("Maria Ivanova");
  });

  it("does not leak fields beyond the public allowlist", async () => {
    mockDb.certificate.findUnique.mockResolvedValue(certificateRecord());

    const response = await GET(
      new NextRequest("http://localhost/api/certificates/verify?number=MAE-2026-ABC12345"),
    );

    const json = await response.json();
    // certificate id, user id and email must never reach an anonymous caller
    expect(json.certificate.id).toBeUndefined();
    expect(json.certificate.userId).toBeUndefined();
    expect(json.certificate.userEmail).toBeUndefined();
    expect(Object.keys(json.certificate).sort()).toEqual([
      "courseSlug",
      "courseTitle",
      "issuedAt",
      "number",
      "userName",
    ]);
  });

  it("delegates unexpected errors to the shared error handler", async () => {
    mockDb.certificate.findUnique.mockRejectedValue(new Error("connection lost"));

    const response = await GET(
      new NextRequest("http://localhost/api/certificates/verify?number=MAE-2026-ABC12345"),
    );

    expect(response.status).toBe(500);
    expect(mockHandleApiError).toHaveBeenCalledTimes(1);
  });
});
