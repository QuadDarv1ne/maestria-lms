/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCdnUrl } = vi.hoisted(() => ({
  mockCdnUrl: { current: "https://cdn.example.com/path/" },
}));

vi.mock("@/lib/env", () => ({
  env: {
    get cdnUrl() {
      return mockCdnUrl.current;
    },
  },
}));

import { resolveCourseImageUrl, getLocalFallbackImage } from "@/lib/courseImage";

describe("resolveCourseImageUrl", () => {
  beforeEach(() => {
    mockCdnUrl.current = "https://cdn.example.com/path/";
  });

  it("should return null for empty url", () => {
    expect(resolveCourseImageUrl(null)).toBeNull();
    expect(resolveCourseImageUrl(undefined)).toBeNull();
    expect(resolveCourseImageUrl("")).toBeNull();
  });

  it("should leave absolute http URLs untouched", () => {
    expect(resolveCourseImageUrl("http://freeimage.host/x.png")).toBe("http://freeimage.host/x.png");
    expect(resolveCourseImageUrl("https://iili.io/abc.jpg")).toBe("https://iili.io/abc.jpg");
  });

  it("should strip /courses/ prefix and join CDN base", () => {
    expect(resolveCourseImageUrl("/courses/foo.jpg")).toBe("https://cdn.example.com/path/foo.jpg");
  });

  it("should handle CDN base without trailing slash", () => {
    mockCdnUrl.current = "https://cdn.example.com";
    expect(resolveCourseImageUrl("/courses/foo.jpg")).toBe("https://cdn.example.com/foo.jpg");
  });

  it("should prepend CDN base for other relative paths", () => {
    expect(resolveCourseImageUrl("header.png")).toBe("https://cdn.example.com/path/header.png");
  });

  it("should return the local path when no CDN is configured", () => {
    mockCdnUrl.current = "";
    expect(resolveCourseImageUrl("/courses/foo.jpg")).toBe("/courses/foo.jpg");
  });

  it("should return the local fallback image path", () => {
    expect(getLocalFallbackImage()).toBe("/courses/placeholder.svg");
  });
});
