/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { NextResponse } from "next/server";
import {
  validateBody,
  validateQuery,
  validateParams,
  paginationSchema,
  searchSchema,
  uuidSchema,
  idOrSlugSchema,
  safeJsonParse,
  withErrorHandling,
} from "@/lib/request-validation";

describe("validateBody", () => {
  const schema = z.object({ title: z.string().min(1) });

  it("returns parsed data for valid body", () => {
    const result = validateBody({ title: "Курс" }, schema);
    expect("data" in result).toBe(true);
    if ("data" in result) expect(result.data).toEqual({ title: "Курс" });
  });

  it("returns 400 response for invalid body", async () => {
    const result = validateBody({ title: "" }, schema);
    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(typeof body.error).toBe("string");
    }
  });

  it("rejects body with wrong field types", async () => {
    const result = validateBody({ title: 42 }, schema);
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(400);
  });

  it("rejects missing fields", async () => {
    const result = validateBody({}, schema);
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(400);
  });
});

describe("validateQuery", () => {
  const schema = z.object({ page: z.coerce.number().int().min(1) });

  it("returns parsed data for valid query", () => {
    const result = validateQuery(new URLSearchParams({ page: "3" }), schema);
    expect("data" in result).toBe(true);
    if ("data" in result) expect(result.data).toEqual({ page: 3 });
  });

  it("returns 400 response for invalid query", async () => {
    const result = validateQuery(new URLSearchParams({ page: "-1" }), schema);
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(400);
  });
});

describe("validateParams", () => {
  it("accepts non-empty params for idOrSlugSchema", () => {
    const result = validateParams({ id: "my-slug" }, z.object({ id: idOrSlugSchema }));
    expect("data" in result).toBe(true);
    if ("data" in result) expect(result.data).toEqual({ id: "my-slug" });
  });

  it("rejects empty id", async () => {
    const result = validateParams({ id: "" }, z.object({ id: idOrSlugSchema }));
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(400);
  });

  it("accepts valid UUID for uuidSchema", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result = validateParams({ id: uuid }, z.object({ id: uuidSchema }));
    expect("data" in result).toBe(true);
  });

  it("rejects invalid UUID for uuidSchema", async () => {
    const result = validateParams({ id: "not-a-uuid" }, z.object({ id: uuidSchema }));
    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(typeof body.error).toBe("string");
    }
  });
});

describe("paginationSchema", () => {
  it("applies defaults", () => {
    const parsed = paginationSchema.parse({});
    expect(parsed).toEqual({ page: 1, limit: 20 });
  });

  it("parses provided values", () => {
    const parsed = paginationSchema.parse({ page: "2", limit: "10" });
    expect(parsed).toEqual({ page: 2, limit: 10 });
  });

  it("rejects limit above max 100", () => {
    const parsed = paginationSchema.safeParse({ limit: "500" });
    expect(parsed.success).toBe(false);
  });

  it("rejects zero page", () => {
    const parsed = paginationSchema.safeParse({ page: "0" });
    expect(parsed.success).toBe(false);
  });
});

describe("searchSchema", () => {
  it("extends pagination with search and sortBy", () => {
    const parsed = searchSchema.parse({ search: "python", sortBy: "rating" });
    expect(parsed).toMatchObject({ search: "python", sortBy: "rating", page: 1, limit: 20 });
  });

  it("makes search optional", () => {
    const parsed = searchSchema.parse({});
    expect(parsed.search).toBeUndefined();
  });
});

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  it("returns fallback for invalid JSON", () => {
    expect(safeJsonParse("{broken", { a: 0 })).toEqual({ a: 0 });
  });

  it("returns undefined for empty input", () => {
    expect(safeJsonParse(null)).toBeUndefined();
    expect(safeJsonParse("")).toBeUndefined();
  });

  it("returns fallback when input falsy", () => {
    expect(safeJsonParse(undefined, [])).toEqual([]);
  });
});

describe("withErrorHandling", () => {
  it("returns handler result on success", async () => {
    const response = await withErrorHandling(async () => {
      return NextResponse.json({ ok: true });
    });
    expect(response.status).toBe(200);
  });

  it("turns thrown error into 500 response", async () => {
    const fail = () => { throw new Error("boom"); };
    const response = await withErrorHandling(async () => {
      fail();
      return NextResponse.json({});
    });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(typeof body.error).toBe("string");
  });

  it("maps known Prisma errors to their status", async () => {
    const fail = () => { throw Object.assign(new Error("record not found"), { code: "P2025" }); };
    const response = await withErrorHandling(async () => {
      fail();
      return NextResponse.json({});
    });
    expect(response.status).toBe(404);
  });

  it("maps Zod errors to 400", async () => {
    const fail = () => { throw { issues: [{ message: "Invalid input" }] }; };
    const response = await withErrorHandling(async () => {
      fail();
      return NextResponse.json({});
    });
    expect(response.status).toBe(400);
  });
});