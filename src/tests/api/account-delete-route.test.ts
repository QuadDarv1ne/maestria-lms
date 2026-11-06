// @vitest-environment node
/**
 * Route-level tests for DELETE /api/user/account (account erasure).
 *
 * The endpoint is destructive and irreversible, so the tests pin down every
 * guard: authentication, the explicit confirmation token, the password check,
 * the OAuth-account case and the last-admin protection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockDb, mockErase, mockVerifyPassword, mockHandleApiError } = vi.hoisted(() => ({
  mockDb: { user: { findUnique: vi.fn() } },
  mockErase: vi.fn(),
  mockVerifyPassword: vi.fn(),
  mockHandleApiError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
  requireAuth: (session: unknown) => session !== null,
  authErrorResponse: () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
  verifyPassword: (password: string, hash: string) => mockVerifyPassword(password, hash),
}));
vi.mock("@/lib/account-erasure", () => ({
  eraseAccount: (userId: string) => mockErase(userId),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: { accountDelete: {} },
}));
vi.mock("@/lib/api-errors", () => ({
  handleApiError: () => mockHandleApiError(),
}));
vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { getAuthSession } from "@/lib/auth";
import { DELETE } from "@/app/api/user/account/route";

const USER_ID = "user-1";
const PASSWORD = "Str0ngPass123";
const HASH = "$2b$12$hash";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/user/account", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthSession).mockResolvedValue({
    user: { id: USER_ID, role: "student", email: "s@test.com", name: "S" },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  } as never);
  mockDb.user.findUnique.mockResolvedValue({ passwordHash: HASH, role: "student" });
  mockVerifyPassword.mockResolvedValue(true);
  mockErase.mockResolvedValue({ erased: true });
  mockHandleApiError.mockReturnValue(
    new Response(JSON.stringify({ error: "internal" }), { status: 500 }),
  );
});

describe("DELETE /api/user/account", () => {
  it("erases the account when password and confirmation match", async () => {
    const response = await DELETE(request({ password: PASSWORD, confirm: "DELETE" }));

    expect(response.status).toBe(200);
    expect(mockVerifyPassword).toHaveBeenCalledWith(PASSWORD, HASH);
    expect(mockErase).toHaveBeenCalledWith(USER_ID);
    const json = await response.json();
    expect(json.message).toContain("Аккаунт удалён");
  });

  it("returns 401 without a session", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await DELETE(request({ password: PASSWORD, confirm: "DELETE" }));

    expect(response.status).toBe(401);
    expect(mockErase).not.toHaveBeenCalled();
  });

  it("rejects a missing confirmation token", async () => {
    const response = await DELETE(request({ password: PASSWORD }));

    expect(response.status).toBe(400);
    expect(mockVerifyPassword).not.toHaveBeenCalled();
    expect(mockErase).not.toHaveBeenCalled();
  });

  it("rejects a wrong confirmation token", async () => {
    const response = await DELETE(request({ password: PASSWORD, confirm: "delete" }));

    expect(response.status).toBe(400);
    expect(mockErase).not.toHaveBeenCalled();
  });

  it("rejects a missing password", async () => {
    const response = await DELETE(request({ confirm: "DELETE" }));

    expect(response.status).toBe(400);
    expect(mockErase).not.toHaveBeenCalled();
  });

  it("returns 400 for an unparsable body", async () => {
    const response = await DELETE(request("{not json"));

    expect(response.status).toBe(400);
    expect(mockErase).not.toHaveBeenCalled();
  });

  it("returns 403 for a wrong password and does not erase", async () => {
    mockVerifyPassword.mockResolvedValue(false);

    const response = await DELETE(request({ password: "wrong", confirm: "DELETE" }));

    expect(response.status).toBe(403);
    expect(mockErase).not.toHaveBeenCalled();
  });

  it("returns 400 for an OAuth-only account without a password", async () => {
    mockDb.user.findUnique.mockResolvedValue({ passwordHash: null, role: "student" });

    const response = await DELETE(request({ password: PASSWORD, confirm: "DELETE" }));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("поддержку");
    expect(mockVerifyPassword).not.toHaveBeenCalled();
    expect(mockErase).not.toHaveBeenCalled();
  });

  it("returns 404 when the user row is missing", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    const response = await DELETE(request({ password: PASSWORD, confirm: "DELETE" }));

    expect(response.status).toBe(404);
    expect(mockErase).not.toHaveBeenCalled();
  });

  it("returns 409 when the account is the last admin", async () => {
    mockErase.mockResolvedValue({ erased: false, reason: "last_admin" });

    const response = await DELETE(request({ password: PASSWORD, confirm: "DELETE" }));

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toContain("последний");
  });

  it("returns 409 for an already erased account", async () => {
    mockErase.mockResolvedValue({ erased: false, reason: "already_erased" });

    const response = await DELETE(request({ password: PASSWORD, confirm: "DELETE" }));

    expect(response.status).toBe(409);
  });

  it("delegates unexpected failures to the shared error handler", async () => {
    mockErase.mockRejectedValue(new Error("deadlock"));

    const response = await DELETE(request({ password: PASSWORD, confirm: "DELETE" }));

    expect(response.status).toBe(500);
    expect(mockHandleApiError).toHaveBeenCalledTimes(1);
  });
});
