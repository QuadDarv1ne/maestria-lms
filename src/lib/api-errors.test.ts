import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiError, handleApiError } from "./api-errors";
import { log } from "./logger";

vi.mock("./logger", () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("apiError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns JSON response with correct status and message", () => {
    const response = apiError("Not found", 404);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("logs at error level for 5xx status", async () => {
    apiError("Server error", 500, { route: "test" });
    expect(log.error).toHaveBeenCalledWith("Server error", { route: "test" });
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("logs at warn level for 4xx status", async () => {
    apiError("Bad request", 400);
    expect(log.warn).toHaveBeenCalledWith("Bad request", undefined);
    expect(log.error).not.toHaveBeenCalled();
  });
});

describe("handleApiError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 for a plain Error", () => {
    const response = handleApiError(new Error("Something broke"));
    expect(response.status).toBe(500);
    expect(log.error).toHaveBeenCalled();
  });

  it("returns 409 for Prisma P2002 (unique constraint)", () => {
    const prismaError = { code: "P2002", message: "Unique constraint failed" };
    const response = handleApiError(prismaError);
    expect(response.status).toBe(409);
    expect(log.warn).toHaveBeenCalled();
  });

  it("returns 404 for Prisma P2025 (record not found)", () => {
    const prismaError = { code: "P2025", message: "Record not found" };
    const response = handleApiError(prismaError);
    expect(response.status).toBe(404);
    expect(log.warn).toHaveBeenCalled();
  });

  it("returns 400 for Prisma P2003 (foreign key constraint)", () => {
    const prismaError = { code: "P2003", message: "Foreign key constraint failed" };
    const response = handleApiError(prismaError);
    expect(response.status).toBe(400);
    expect(log.warn).toHaveBeenCalled();
  });

  it("returns 400 for Prisma P2014 (relation violation)", () => {
    const prismaError = { code: "P2014", message: "Relation violation" };
    const response = handleApiError(prismaError);
    expect(response.status).toBe(400);
    expect(log.warn).toHaveBeenCalled();
  });

  it("returns 500 for unknown Prisma error code", () => {
    const prismaError = { code: "P9999", message: "Unknown prisma error" };
    const response = handleApiError(prismaError);
    expect(response.status).toBe(500);
    expect(log.error).toHaveBeenCalled();
  });

  it("returns 400 for Zod validation error", () => {
    const zodError = { issues: [{ message: "Invalid email format" }] };
    const response = handleApiError(zodError);
    expect(response.status).toBe(400);
    expect(log.warn).toHaveBeenCalled();
  });

  it("includes context in log output", () => {
    const context = { route: "auth/register", userId: "123" };
    handleApiError(new Error("Test error"), context);
    expect(log.error).toHaveBeenCalledWith(
      "Unhandled API error",
      expect.objectContaining({ ...context, name: "Error", message: "Test error" }),
    );
  });

  it("handles non-Error objects gracefully", () => {
    const response = handleApiError("string error");
    expect(response.status).toBe(500);
    expect(log.error).toHaveBeenCalled();
  });
});
