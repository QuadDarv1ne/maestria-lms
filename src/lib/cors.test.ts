/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  applyCorsHeaders,
  handleCorsPreflight,
  withCors,
} from "@/lib/cors";

const allowedOrigins = ["https://app.example.com"];

function makeRequest(origin: string | null, method = "GET") {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  return new NextRequest("https://app.example.com/api/test", { method, headers });
}

describe("applyCorsHeaders", () => {
  it("sets CORS headers for an allowed origin", () => {
    const res = applyCorsHeaders(NextResponse.json({}), "https://app.example.com", { allowedOrigins });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
  });

  it("does not set Allow-Origin for a disallowed origin", () => {
    const res = applyCorsHeaders(NextResponse.json({}), "https://evil.example.com", { allowedOrigins });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("supports the wildcard origin", () => {
    const res = applyCorsHeaders(NextResponse.json({}), "https://anything.example.com", {
      allowedOrigins: ["*"],
      allowCredentials: false,
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://anything.example.com");
  });

  it("respects allowCredentials=false", () => {
    const res = applyCorsHeaders(NextResponse.json({}), "https://app.example.com", {
      allowedOrigins,
      allowCredentials: false,
    });
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  it("sets expose headers by default", () => {
    const res = applyCorsHeaders(NextResponse.json({}), null, {});
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain("X-RateLimit-Limit");
  });
});

describe("handleCorsPreflight", () => {
  it("returns 204 for allowed preflight", () => {
    const res = handleCorsPreflight(new NextRequest("https://app.example.com/api/test", {
      method: "OPTIONS",
      headers: { origin: "https://app.example.com" },
    }), { allowedOrigins });
    expect(res).not.toBeNull();
    expect(res?.status).toBe(204);
    expect(res?.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
  });

  it("returns null for disallowed preflight", () => {
    const res = handleCorsPreflight(makeRequest("https://evil.example.com", "OPTIONS"), { allowedOrigins });
    expect(res).toBeNull();
  });
});

describe("withCors", () => {
  it("handles preflight requests without calling the handler", async () => {
    let called = false;
    const wrapped = withCors(async () => {
      called = true;
      return NextResponse.json({});
    }, { allowedOrigins });
    const res = await wrapped(
      makeRequest("https://app.example.com", "OPTIONS"),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(204);
    expect(called).toBe(false);
  });

  it("rejects preflight from a disallowed origin", async () => {
    const wrapped = withCors(async () => NextResponse.json({}), { allowedOrigins });
    const res = await wrapped(
      makeRequest("https://evil.example.com", "OPTIONS"),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(403);
  });

  it("adds CORS headers to actual responses", async () => {
    const wrapped = withCors(async () => NextResponse.json({ ok: true }), { allowedOrigins });
    const res = await wrapped(
      makeRequest("https://app.example.com"),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
  });
});