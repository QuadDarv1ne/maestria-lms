// @vitest-environment node
/**
 * Unit tests for the JWT callback in src/lib/auth.ts.
 *
 * The callback is the single place that decides whether an existing token is
 * still valid, so these tests pin down the two rejection rules that were added
 * to it: a deactivated user and a token whose `sessionVersion` is behind the
 * stored row (password reset, password change, 2FA toggle).
 *
 * The callback is invoked directly rather than through NextAuth, which keeps
 * the test focused on the decision logic instead of the framework plumbing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: { user: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/env", () => ({
  env: {
    isProduction: false,
    nextPhase: undefined,
    nextAuthSecret: "test-secret",
  },
}));
vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { authOptions } from "@/lib/auth";
import { invalidateJwtUserCache, setJwtUserCache } from "@/lib/jwt-user-cache";

type JwtCallback = (args: {
  token: Record<string, unknown>;
  user?: unknown;
}) => Promise<Record<string, unknown>>;

const jwtCallback = authOptions.callbacks!.jwt as unknown as JwtCallback;

const USER_ID = "user-1";

/** Fresh token, as issued by `authorize()` for this user. */
function issuedToken(sessionVersion: number) {
  return { id: USER_ID, role: "student", sessionVersion };
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidateJwtUserCache(USER_ID);
  mockDb.user.findUnique.mockResolvedValue({
    role: "student",
    isActive: true,
    sessionVersion: 0,
  });
});

describe("jwt callback — session version", () => {
  it("keeps a token whose version matches the stored row", async () => {
    const result = await jwtCallback({ token: issuedToken(0) });

    expect(result.id).toBe(USER_ID);
    expect(result.role).toBe("student");
  });

  it("stamps the version onto a freshly signed-in token", async () => {
    // `authorize()` and the callback read the same row, so a fresh token always
    // matches the stored version.
    mockDb.user.findUnique.mockResolvedValue({
      role: "teacher",
      isActive: true,
      sessionVersion: 3,
    });

    const result = await jwtCallback({
      token: {},
      user: { id: USER_ID, role: "teacher", sessionVersion: 3 },
    });

    expect(result.sessionVersion).toBe(3);
    expect(result.role).toBe("teacher");
  });

  it("retires a token issued before a password reset", async () => {
    // The password was rotated: the row is now at version 1, the token at 0.
    mockDb.user.findUnique.mockResolvedValue({
      role: "student",
      isActive: true,
      sessionVersion: 1,
    });

    const result = await jwtCallback({ token: issuedToken(0) });

    // "{}" is the established signal for an invalid token; the session callback
    // turns it into a session with an empty user id, which requireAuth rejects.
    expect(result).toEqual({});
  });

  it("retires a legacy token that carries no version at all", async () => {
    const result = await jwtCallback({ token: { id: USER_ID, role: "student" } });

    expect(result).toEqual({});
  });

  it("retires a token issued before a 2FA change", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      role: "student",
      isActive: true,
      sessionVersion: 2,
    });

    const result = await jwtCallback({ token: issuedToken(1) });

    expect(result).toEqual({});
  });

  it("uses the cached snapshot instead of re-reading the row", async () => {
    setJwtUserCache(USER_ID, { role: "admin", isActive: true, sessionVersion: 0 });

    const result = await jwtCallback({ token: issuedToken(0) });

    expect(result.role).toBe("admin");
    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a deactivated user even when the version matches", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      role: "student",
      isActive: false,
      sessionVersion: 0,
    });

    const result = await jwtCallback({ token: issuedToken(0) });

    expect(result).toEqual({});
  });

  it("rejects a token for a user that no longer exists", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    const result = await jwtCallback({ token: issuedToken(0) });

    expect(result).toEqual({});
  });

  it("returns the token untouched when it carries no user id", async () => {
    const result = await jwtCallback({ token: { role: "student" } });

    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
    expect(result.role).toBe("student");
  });
});
