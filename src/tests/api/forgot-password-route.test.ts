// @vitest-environment node
/**
 * Route-level tests for PUT /api/auth/forgot-password (password reset).
 *
 * The handler must rotate the password and clear outstanding reset tokens in a
 * single interactive transaction; the array form of $transaction cannot work
 * through the lazy `db` proxy.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";

const { mockDb, mockTx, mockHandleApiError } = vi.hoisted(() => ({
  mockDb: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    verificationToken: { findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
  mockTx: {
    user: { update: vi.fn() },
    verificationToken: { deleteMany: vi.fn() },
  },
  mockHandleApiError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/auth", () => ({ hashPassword: vi.fn().mockResolvedValue("new-hash") }));
vi.mock("@/lib/env", () => ({ env: { siteUrl: "http://localhost:3000", isProduction: false } }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: { forgotPassword: {}, resetPassword: {} },
}));
vi.mock("@/lib/api-errors", () => ({
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));
vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/emails", () => ({
  passwordResetEmail: () => ({ subject: "subject", html: "<p>html</p>" }),
}));
vi.mock("@/lib/constants", () => ({ MS: { HOUR: 3_600_000 } }));

import { PUT } from "@/app/api/auth/forgot-password/route";

const TOKEN = "reset-token-abc";
const TOKEN_HASH = createHash("sha256").update(TOKEN).digest("hex");
const PASSWORD = "Str0ngPass123";
const EMAIL = "student@example.com";

function putRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.verificationToken.findUnique.mockResolvedValue({
    token: TOKEN_HASH,
    identifier: `reset-password:${EMAIL}`,
    expires: new Date(Date.now() + 3_600_000),
  });
  mockDb.verificationToken.delete.mockResolvedValue({});
  mockTx.user.update.mockResolvedValue({});
  mockTx.verificationToken.deleteMany.mockResolvedValue({ count: 1 });
  mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockTx));
  mockHandleApiError.mockReturnValue(new Response(JSON.stringify({ error: "internal" }), { status: 500 }));
});

describe("PUT /api/auth/forgot-password", () => {
  it("rotates the password and clears outstanding reset tokens atomically", async () => {
    const res = await PUT(putRequest({ token: TOKEN, password: PASSWORD }));
    expect(res.status).toBe(200);

    // Interactive transaction only — the array form is incompatible with the proxy.
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    expect(typeof mockDb.$transaction.mock.calls[0][0]).toBe("function");
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { email: EMAIL },
      data: { passwordHash: "new-hash" },
    });
    expect(mockTx.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: `reset-password:${EMAIL}` },
    });
    // user.update must not be issued outside the transaction
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("rejects an unknown token", async () => {
    mockDb.verificationToken.findUnique.mockResolvedValue(null);

    const res = await PUT(putRequest({ token: TOKEN, password: PASSWORD }));
    expect(res.status).toBe(400);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects and deletes an expired token", async () => {
    mockDb.verificationToken.findUnique.mockResolvedValue({
      token: TOKEN_HASH,
      identifier: `reset-password:${EMAIL}`,
      expires: new Date(Date.now() - 1_000),
    });

    const res = await PUT(putRequest({ token: TOKEN, password: PASSWORD }));
    expect(res.status).toBe(400);
    expect(mockDb.verificationToken.delete).toHaveBeenCalledWith({ where: { token: TOKEN_HASH } });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a token that was not issued for a password reset", async () => {
    mockDb.verificationToken.findUnique.mockResolvedValue({
      token: TOKEN_HASH,
      identifier: `verify-email:${EMAIL}`,
      expires: new Date(Date.now() + 3_600_000),
    });

    const res = await PUT(putRequest({ token: TOKEN, password: PASSWORD }));
    expect(res.status).toBe(400);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a weak password before touching the database", async () => {
    const res = await PUT(putRequest({ token: TOKEN, password: "weak" }));
    expect(res.status).toBe(400);
    expect(mockDb.verificationToken.findUnique).not.toHaveBeenCalled();
  });
});
