import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import {
  API_VERSIONS,
  CURRENT_API_VERSION,
  MINIMUM_SUPPORTED_VERSION,
  getApiVersion,
  isVersionSupported,
  isVersionDeprecated,
  isVersionSunset,
  getVersionInfo,
  getAllVersions,
  addVersionHeaders,
  validateApiVersion,
  withApiVersion,
} from "@/lib/api-versioning";

describe("getApiVersion", () => {
  it("defaults to the current version without headers or prefix", () => {
    const req = new Request("https://app.example.com/api/courses");
    expect(getApiVersion(req)).toBe(CURRENT_API_VERSION);
    expect(CURRENT_API_VERSION).toBe("2.0.0");
  });

  it("reads an exact Accept-Version header", () => {
    const req = new Request("https://app.example.com/api/courses", {
      headers: { "Accept-Version": "1.0.0" },
    });
    expect(getApiVersion(req)).toBe(API_VERSIONS.V1);
  });

  it("accepts partial versions via the header", () => {
    expect(
      getApiVersion(new Request("https://x.test/api", { headers: { "Accept-Version": "2" } })),
    ).toBe(API_VERSIONS.V2);
    expect(
      getApiVersion(new Request("https://x.test/api", { headers: { "Accept-Version": "1.0" } })),
    ).toBe(API_VERSIONS.V1);
  });

  it("ignores an unknown header version and falls back to the default", () => {
    const req = new Request("https://x.test/api", { headers: { "Accept-Version": "9.9.9" } });
    expect(getApiVersion(req)).toBe(CURRENT_API_VERSION);
  });

  it("resolves the version from the URL prefix", () => {
    expect(getApiVersion(new Request("https://x.test/api/v1/courses"))).toBe(API_VERSIONS.V1);
    expect(getApiVersion(new Request("https://x.test/api/v2/courses"))).toBe(API_VERSIONS.V2);
  });

  it("falls back to the current version for unknown URL prefixes", () => {
    expect(getApiVersion(new Request("https://x.test/api/v3/courses"))).toBe(CURRENT_API_VERSION);
    expect(getApiVersion(new Request("https://x.test/api/courses"))).toBe(CURRENT_API_VERSION);
  });
});

describe("version helpers", () => {
  it("isVersionSupported", () => {
    expect(isVersionSupported("1.0.0")).toBe(true);
    expect(isVersionSupported("2.0.0")).toBe(true);
    expect(isVersionSupported("3.0.0")).toBe(false);
    expect(isVersionSupported("1.0")).toBe(false);
  });

  it("has no deprecated or sunset versions in the registry", () => {
    expect(isVersionDeprecated(API_VERSIONS.V1)).toBe(false);
    expect(isVersionDeprecated(API_VERSIONS.V2)).toBe(false);
    expect(isVersionSunset(API_VERSIONS.V1)).toBe(false);
    expect(MINIMUM_SUPPORTED_VERSION).toBe(API_VERSIONS.V1);
  });

  it("getVersionInfo returns registered info or null", () => {
    expect(getVersionInfo(API_VERSIONS.V1)?.changelog).toContain("Initial API release");
    expect(getVersionInfo("9.0.0" as typeof API_VERSIONS.V1)).toBeNull();
  });

  it("getAllVersions returns versions sorted newest first", () => {
    const versions = getAllVersions().map((v) => v.version);
    expect(versions).toEqual(["2.0.0", "1.0.0"]);
  });
});

describe("addVersionHeaders", () => {
  it("sets the X-API-Version header", () => {
    const headers = new Headers();
    addVersionHeaders(headers, API_VERSIONS.V1);
    expect(headers.get("X-API-Version")).toBe("1.0.0");
  });

  it("does not add deprecation headers when the version is not deprecated", () => {
    const headers = new Headers();
    addVersionHeaders(headers, API_VERSIONS.V2);
    expect(headers.get("X-API-Deprecated")).toBeNull();
    expect(headers.get("Sunset")).toBeNull();
  });
});

describe("validateApiVersion", () => {
  it("returns null for any registered version (none are sunset)", () => {
    expect(validateApiVersion(new Request("https://x.test/api/v1/courses"))).toBeNull();
    expect(validateApiVersion(new Request("https://x.test/api/v2/courses"))).toBeNull();
  });
});

describe("withApiVersion", () => {
  it("invokes the handler with the resolved version and adds version headers", async () => {
    let receivedVersion: string | null = null;
    const wrapped = withApiVersion(async (_request, version) => {
      receivedVersion = version;
      return NextResponse.json({ ok: true });
    });

    const res = await wrapped(new Request("https://x.test/api/v1/courses"));
    expect(receivedVersion).toBe(API_VERSIONS.V1);
    expect(res.headers.get("X-API-Version")).toBe("1.0.0");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("works with the default version when no prefix is supplied", async () => {
    const wrapped = withApiVersion(async (_request, version) => NextResponse.json({ version }));
    const res = await wrapped(new Request("https://x.test/api/courses"));
    expect(res.headers.get("X-API-Version")).toBe(CURRENT_API_VERSION);
    expect((await res.json()).version).toBe(CURRENT_API_VERSION);
  });
});