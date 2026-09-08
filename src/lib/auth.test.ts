import { describe, it, expect } from "vitest";
import type { ExtendedSession } from "./auth";
import {
  requireAuth,
  requireAdmin,
  authErrorResponse,
  adminErrorResponse,
} from "./auth";

describe("requireAuth", () => {
  it("returns true for authenticated session", () => {
    const session = {
      user: { id: "user-1", role: "student" },
      expires: "2030-01-01T00:00:00.000Z",
    } as ExtendedSession;

    expect(requireAuth(session)).toBe(true);
  });

  it("returns false for null session", () => {
    expect(requireAuth(null)).toBe(false);
  });

  it("returns false for session without user", () => {
    const session = { user: null, expires: "2030-01-01T00:00:00.000Z" } as unknown as ExtendedSession | null;

    expect(requireAuth(session)).toBe(false);
  });
});

describe("requireAdmin", () => {
  it("returns true for admin session", () => {
    const session = {
      user: { id: "admin-1", role: "admin" },
      expires: "2030-01-01T00:00:00.000Z",
    } as ExtendedSession;

    expect(requireAdmin(session)).toBe(true);
  });

  it("returns false for null session", () => {
    expect(requireAdmin(null)).toBe(false);
  });

  it("returns false for non-admin role", () => {
    const session = {
      user: { id: "user-1", role: "student" },
      expires: "2030-01-01T00:00:00.000Z",
    } as ExtendedSession;

    expect(requireAdmin(session)).toBe(false);
  });

  it("returns false for teacher role", () => {
    const session = {
      user: { id: "teacher-1", role: "teacher" },
      expires: "2030-01-01T00:00:00.000Z",
    } as ExtendedSession;

    expect(requireAdmin(session)).toBe(false);
  });
});

describe("authErrorResponse", () => {
  it("returns 401 response", () => {
    const response = authErrorResponse();

    expect(response.status).toBe(401);
  });

  it("returns Russian error message", async () => {
    const response = authErrorResponse();
    const body = await response.json() as { error: string };

    expect(body.error).toBe("Необходимо авторизоваться");
  });
});

describe("adminErrorResponse", () => {
  it("returns 403 response", () => {
    const response = adminErrorResponse();

    expect(response.status).toBe(403);
  });

  it("returns Russian error message", async () => {
    const response = adminErrorResponse();
    const body = await response.json() as { error: string };

    expect(body.error).toBe("Доступ запрещён. Требуются права администратора");
  });
});
