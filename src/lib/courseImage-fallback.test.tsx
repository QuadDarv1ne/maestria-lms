/**
 * The local fallback cover is an SVG. The Next.js image optimizer refuses to
 * serve SVG unless `dangerouslyAllowSVG` is enabled globally, and turning that
 * on for the whole app would let any uploaded SVG execute script — so the
 * fallback must be served straight from /public instead.
 *
 * Before this test existed `CourseImage` sent `/courses/placeholder.svg`
 * through /_next/image, which answered 400: a course with a broken cover
 * rendered an empty box rather than the placeholder. Verified against a
 * production build (`/_next/image?url=%2Fcourses%2Fplaceholder.svg` → 400,
 * `/courses/placeholder.svg` → 200).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";

const { mockCdnUrl } = vi.hoisted(() => ({
  mockCdnUrl: { current: "" },
}));

vi.mock("@/lib/env", () => ({
  env: {
    get cdnUrl() {
      return mockCdnUrl.current;
    },
  },
}));

import { CourseImage } from "@/components/CourseImage";
import { isVectorImage } from "@/lib/courseImage";

function renderedSrc(container: HTMLElement): string {
  return container.querySelector("img")?.getAttribute("src") ?? "";
}

describe("isVectorImage", () => {
  it("detects svg paths regardless of query or hash", () => {
    expect(isVectorImage("/courses/placeholder.svg")).toBe(true);
    expect(isVectorImage("/courses/placeholder.svg?v=2")).toBe(true);
    expect(isVectorImage("/courses/placeholder.SVG")).toBe(true);
  });

  it("treats raster formats and empty values as optimizable", () => {
    expect(isVectorImage("/courses/cpp-plus-plus.png")).toBe(false);
    expect(isVectorImage("/courses/photo.jpg")).toBe(false);
    expect(isVectorImage(null)).toBe(false);
    expect(isVectorImage(undefined)).toBe(false);
  });
});

describe("CourseImage fallback", () => {
  afterEach(() => {
    cleanup();
    mockCdnUrl.current = "";
  });

  it("routes raster covers through the optimizer", () => {
    const { container } = render(<CourseImage src="/courses/cpp-plus-plus.png" alt="Курс" />);
    const src = renderedSrc(container);
    expect(src).toContain("_next/image");
    expect(src).toContain(encodeURIComponent("/courses/cpp-plus-plus.png"));
  });

  it("falls back to the svg placeholder without the optimizer when a cover fails", () => {
    const { container } = render(
      <CourseImage src="https://cdn.example.com/gone.png" alt="Курс" />,
    );
    fireEvent.error(container.querySelector("img") as HTMLImageElement);

    expect(renderedSrc(container)).toBe("/courses/placeholder.svg");
  });

  it("renders nothing when there is neither a cover nor a fallback", () => {
    const { container } = render(<CourseImage src={null} alt="Курс" />);
    expect(container.querySelector("img")).toBeNull();
  });
});
