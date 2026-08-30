/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateSearchParams } from "@/lib/api-validation";

const schema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().max(50).optional(),
});

describe("validateSearchParams", () => {
  it("should parse valid params", () => {
    const sp = new URLSearchParams({ page: "2", limit: "50", q: "hello" });
    const result = validateSearchParams(sp, schema);
    expect(result).not.toBeInstanceOf(Response);
    expect(result).toEqual({ page: 2, limit: 50, q: "hello" });
  });

  it("should return empty object for no params (all optional)", () => {
    const sp = new URLSearchParams();
    const result = validateSearchParams(sp, schema);
    expect(result).toEqual({});
  });

  it("should return 400 when params are invalid", () => {
    const sp = new URLSearchParams({ page: "0" });
    const result = validateSearchParams(sp, schema);
    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(400);
  });

  it("should return 400 when limit exceeds max", () => {
    const sp = new URLSearchParams({ limit: "999" });
    const result = validateSearchParams(sp, schema);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
  });

  it("should include the first issue message in the 400 body", async () => {
    const required = z.object({ id: z.string().min(1) });
    const sp = new URLSearchParams();
    const result = validateSearchParams(sp, required);
    expect(result).toBeInstanceOf(Response);
    const body = await (result as Response).json();
    expect(body.error).toMatch(/Invalid|Too small|Required/i);
  });
});
