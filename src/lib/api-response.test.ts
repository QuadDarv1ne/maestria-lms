/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import {
  withTimeout,
  apiNotFoundResponse,
  apiMethodNotAllowedResponse,
  apiBadRequestResponse,
  apiConflictResponse,
  apiServiceUnavailableResponse,
  apiSuccessResponse,
  apiPaginatedResponse,
  apiUnauthorizedResponse,
  apiForbiddenResponse,
  apiInternalError,
  apiValidationErrorResponse,
} from "@/lib/api-response";

describe("withTimeout", () => {
  it("resolves with handler result", async () => {
    const result = await withTimeout(async () => "done", 1000);
    expect(result).toBe("done");
  });

  it("rejects with timeout message when handler is too slow", async () => {
    const never = () => new Promise<string>(() => {});
    await expect(withTimeout(never, 30, "slow")).rejects.toThrow("slow");
  });

  it("propagates handler errors", async () => {
    await expect(withTimeout(async () => { throw new Error("boom"); }, 1000)).rejects.toThrow("boom");
  });

  it("uses default timeout message", async () => {
    const never = () => new Promise<string>(() => {});
    await expect(withTimeout(never, 30)).rejects.toThrow("Request timed out");
  });
});

describe("api response helpers", () => {
  async function read(response: Response) {
    return { status: response.status, body: await response.json() };
  }

  it("apiNotFoundResponse returns 404 with code", async () => {
    const r = await read(apiNotFoundResponse("Course", "c1"));
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ code: "NOT_FOUND", error: "Course not found: c1" });
  });

  it("apiNotFoundResponse omits id when not given", async () => {
    const r = await read(apiNotFoundResponse("Course"));
    expect(r.body.error).toBe("Course not found");
  });

  it("apiMethodNotAllowedResponse returns 405 with Allow header", async () => {
    const res = apiMethodNotAllowedResponse(["GET", "POST"]);
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, POST");
    const body = await res.json();
    expect(body.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("apiBadRequestResponse returns 400 with details", async () => {
    const r = await read(apiBadRequestResponse("Bad input", { field: "title" }));
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ code: "BAD_REQUEST", details: { field: "title" } });
  });

  it("apiBadRequestResponse omits details when undefined", async () => {
    const r = await read(apiBadRequestResponse("Bad input"));
    expect(r.body.details).toBeUndefined();
  });

  it("apiConflictResponse returns 409", async () => {
    const r = await read(apiConflictResponse("Already exists"));
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ code: "CONFLICT", error: "Already exists" });
  });

  it("apiServiceUnavailableResponse returns 503 with default message", async () => {
    const r = await read(apiServiceUnavailableResponse());
    expect(r.status).toBe(503);
    expect(r.body.code).toBe("SERVICE_UNAVAILABLE");
    expect(r.body.error).toBe("Service temporarily unavailable");
  });

  it("apiSuccessResponse wraps data and optional meta", async () => {
    const r = await read(apiSuccessResponse({ id: 1 }, { total: 5 }));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ data: { id: 1 }, meta: { total: 5 } });
  });

  it("apiSuccessResponse omits meta when not provided", async () => {
    const r = await read(apiSuccessResponse([], undefined, 201));
    expect(r.status).toBe(201);
    expect(r.body.meta).toBeUndefined();
    expect(r.body.data).toEqual([]);
  });

  it("apiPaginatedResponse includes pagination object", async () => {
    const r = await read(apiPaginatedResponse(["a"], { page: 1, limit: 20, total: 1, totalPages: 1 }));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      data: ["a"],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it("apiUnauthorizedResponse returns 401", async () => {
    const r = await read(apiUnauthorizedResponse());
    expect(r.status).toBe(401);
    expect(r.body.code).toBe("UNAUTHORIZED");
  });

  it("apiForbiddenResponse returns 403", async () => {
    const r = await read(apiForbiddenResponse("Nope"));
    expect(r.status).toBe(403);
    expect(r.body.code).toBe("FORBIDDEN");
  });

  it("apiInternalError returns 500 with details", async () => {
    const r = await read(apiInternalError("Oops", { stack: "trace" }));
    expect(r.status).toBe(500);
    expect(r.body).toMatchObject({ code: "INTERNAL_ERROR", details: { stack: "trace" } });
  });

  it("apiValidationErrorResponse returns 422 with field errors", async () => {
    const r = await read(apiValidationErrorResponse("Invalid", { title: ["required"] }));
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ code: "VALIDATION_ERROR", errors: { title: ["required"] } });
  });
});