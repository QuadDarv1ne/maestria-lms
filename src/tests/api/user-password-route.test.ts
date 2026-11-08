// @vitest-environment node
/**
 * Route-level tests for PUT /api/user/password.
 *
 * The endpoint is the only way for a signed-in user to rotate their own
 * password without leaving the session, so the tests pin down the two things
 * that make it safe: the current password is verified, and success bumps
 * `sessionVersion` so every token issued before the change dies.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockDb, mockVerifyPassword, mockHashPassword, mockInvalidate, mockHandleApiError } =
  vi.hoisted(() => ({
    mockDb: {
      user: { findUnique: vi.fn(), update: vi.fn() },
    },
    mockVerifyPassword: vi.fn(),
    mockHashPassword: vi.fn(),
    mockInvalidate: vi.fn(),
    mockHandleApiError: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
  requireAuth: vi.fn(),
  authErrorResponse: vi.fn(
    () => new Response(JSON.stringify({ error: "Необходимо авторизоваться" }), { status: 401 }),
  ),
  verifyPassword: (...args: unknown[]) => mockVerifyPassword(...args),
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
}));
vi.mock("@/lib/jwt-user-cache", () => ({
  invalidateJwtUserCache: (...args: unknown[]) => mockInvalidate(...args),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: { passwordChange: { windowMs: 60_000, maxRequests: 5 } },
}));
vi.mock("@/lib/api-errors", () => ({
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));
vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { getAuthSession, requireAuth } from "@/lib/auth";
import { PUT } from "@/app/api/user/password/route";

const USER_ID = "user-1";
const CURRENT = "OldPass123";
const NEW = "NewPass456";

function putRequest(body: unknown) {
  return new NextRequest("http://localhost/api/user/password", {
    method: "PUT",
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
  mockDb.user.findUnique.mockResolvedValue({
    id: USER_ID,
    email: "student@example.com",
    passwordHash: "old-hash",
  });
  mockDb.user.update.mockResolvedValue({});
  mockVerifyPassword.mockResolvedValue(true);
  mockHashPassword.mockResolvedValue("new-hash");
  mockHandleApiError.mockReturnValue(
    new Response(JSON.stringify({ error: "internal" }), { status: 500 }),
  );
});

describe("PUT /api/user/password", () => {
  it("rotates the hash and bumps the session version", async () => {
    const res = await PUT(putRequest({ currentPassword: CURRENT, newPassword: NEW }));
    expect(res.status).toBe(200);

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { passwordHash: "new-hash", sessionVersion: { increment: 1 } },
    });
    expect(mockInvalidate).toHaveBeenCalledWith(USER_ID);

    const body = await res.json();
    expect(body.reauthenticationRequired).toBe(true);
  });

  it("rejects an unauthenticated caller without touching the database", async () => {
    vi.mocked(requireAuth).mockReturnValue(false);

    const res = await PUT(putRequest({ currentPassword: CURRENT, newPassword: NEW }));
    expect(res.status).toBe(401);
    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("rejects a wrong current password", async () => {
    mockVerifyPassword.mockResolvedValue(false);

    const res = await PUT(putRequest({ currentPassword: "wrong", newPassword: NEW }));
    expect(res.status).toBe(403);
    expect(mockDb.user.update).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("rejects a new password that equals the current one", async () => {
    const res = await PUT(putRequest({ currentPassword: CURRENT, newPassword: CURRENT }));
    expect(res.status).toBe(400);
    expect(mockVerifyPassword).not.toHaveBeenCalled();
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("rejects a weak new password before any password check", async () => {
    const res = await PUT(putRequest({ currentPassword: CURRENT, newPassword: "weak" }));
    expect(res.status).toBe(400);
    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });

  it("refuses accounts without a password (OAuth-only)", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: USER_ID,
      email: "student@example.com",
      passwordHash: null,
    });

    const res = await PUT(putRequest({ currentPassword: CURRENT, newPassword: NEW }));
    expect(res.status).toBe(400);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the session points at a deleted user", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    const res = await PUT(putRequest({ currentPassword: CURRENT, newPassword: NEW }));
    expect(res.status).toBe(404);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("rejects a malformed body", async () => {
    const res = await PUT(
      new NextRequest("http://localhost/api/user/password", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("routes database failures through handleApiError", async () => {
    mockDb.user.update.mockRejectedValue(new Error("db down"));

    const res = await PUT(putRequest({ currentPassword: CURRENT, newPassword: NEW }));
    expect(res.status).toBe(500);
    expect(mockHandleApiError).toHaveBeenCalledTimes(1);
  });
});
