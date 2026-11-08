// @vitest-environment node
/**
 * Route-level tests for the 2FA endpoints.
 *
 * Enabling or disabling a second factor is a security-policy change, so the
 * tests pin down that both directions bump `sessionVersion` (retiring tokens
 * minted under the old policy) and drop the cached role/status.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockDb, mockVerify, mockCompare, mockInvalidateJwtUserCache, mockHandleApiError } =
  vi.hoisted(() => ({
    mockDb: { user: { findUnique: vi.fn(), update: vi.fn() } },
    mockVerify: vi.fn(),
    mockCompare: vi.fn(),
    mockInvalidateJwtUserCache: vi.fn(),
    mockHandleApiError: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
  requireAuth: vi.fn(),
  authErrorResponse: vi.fn(
    () => new Response(JSON.stringify({ error: "Необходимо авторизоваться" }), { status: 401 }),
  ),
}));

vi.mock("@/lib/jwt-user-cache", () => ({
  invalidateJwtUserCache: (...args: unknown[]) => mockInvalidateJwtUserCache(...args),
}));

vi.mock("otplib", () => ({
  authenticator: { verify: (...args: unknown[]) => mockVerify(...args) },
}));

vi.mock("bcryptjs", () => ({
  default: { compare: (...args: unknown[]) => mockCompare(...args) },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: { twoFactor: { windowMs: 60_000, maxRequests: 10 } },
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { getAuthSession, requireAuth } from "@/lib/auth";
import { PUT, DELETE } from "@/app/api/auth/2fa/route";

const USER_ID = "user-1";
const PASSWORD = "Str0ngPass1";
const CODE = "123456";

function request(method: "PUT" | "DELETE", body: unknown) {
  return new NextRequest("http://localhost/api/auth/2fa", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthSession).mockResolvedValue({
    user: { id: USER_ID, role: "student" },
  } as never);
  vi.mocked(requireAuth).mockReturnValue(true);
  mockDb.user.update.mockResolvedValue({});
  mockVerify.mockReturnValue(true);
  mockCompare.mockResolvedValue(true);
  mockHandleApiError.mockReturnValue(
    new Response(JSON.stringify({ error: "internal" }), { status: 500 }),
  );
});

describe("PUT /api/auth/2fa — enable", () => {
  beforeEach(() => {
    mockDb.user.findUnique.mockResolvedValue({
      id: USER_ID,
      email: "student@example.com",
      twoFactorEnabled: false,
      twoFactorSecret: null,
      pendingTwoFactorSecret: "PENDING23456789012345678901234567",
      passwordHash: "hash",
    });
  });

  it("activates 2FA, bumps the version and drops the cache", async () => {
    const res = await PUT(request("PUT", { code: CODE }));
    expect(res.status).toBe(200);

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: {
        twoFactorSecret: "PENDING23456789012345678901234567",
        twoFactorEnabled: true,
        pendingTwoFactorSecret: null,
        sessionVersion: { increment: 1 },
      },
    });
    expect(mockInvalidateJwtUserCache).toHaveBeenCalledWith(USER_ID);

    const body = await res.json();
    expect(body.reauthenticationRequired).toBe(true);
  });

  it("rejects a wrong code without writing anything", async () => {
    mockVerify.mockReturnValue(false);

    const res = await PUT(request("PUT", { code: CODE }));
    expect(res.status).toBe(400);
    expect(mockDb.user.update).not.toHaveBeenCalled();
    expect(mockInvalidateJwtUserCache).not.toHaveBeenCalled();
  });

  it("rejects verification when no setup was requested", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: USER_ID,
      email: "student@example.com",
      twoFactorEnabled: false,
      twoFactorSecret: null,
      pendingTwoFactorSecret: null,
      passwordHash: "hash",
    });

    const res = await PUT(request("PUT", { code: CODE }));
    expect(res.status).toBe(400);
    expect(mockVerify).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/auth/2fa — disable", () => {
  beforeEach(() => {
    mockDb.user.findUnique.mockResolvedValue({
      id: USER_ID,
      email: "student@example.com",
      twoFactorEnabled: true,
      twoFactorSecret: "ACTIVE234567890123456789012345678",
      pendingTwoFactorSecret: null,
      passwordHash: "hash",
    });
  });

  it("disables 2FA, bumps the version and drops the cache", async () => {
    const res = await DELETE(request("DELETE", { password: PASSWORD, code: CODE }));
    expect(res.status).toBe(200);

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        sessionVersion: { increment: 1 },
      },
    });
    expect(mockInvalidateJwtUserCache).toHaveBeenCalledWith(USER_ID);
  });

  it("rejects a wrong password", async () => {
    mockCompare.mockResolvedValue(false);

    const res = await DELETE(request("DELETE", { password: "wrong", code: CODE }));
    expect(res.status).toBe(401);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("rejects a wrong code", async () => {
    mockVerify.mockReturnValue(false);

    const res = await DELETE(request("DELETE", { password: PASSWORD, code: CODE }));
    expect(res.status).toBe(400);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("rejects disabling when 2FA is off", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: USER_ID,
      email: "student@example.com",
      twoFactorEnabled: false,
      twoFactorSecret: null,
      pendingTwoFactorSecret: null,
      passwordHash: "hash",
    });

    const res = await DELETE(request("DELETE", { password: PASSWORD, code: CODE }));
    expect(res.status).toBe(400);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });
});
