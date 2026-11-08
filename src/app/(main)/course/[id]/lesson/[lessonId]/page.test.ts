/**
 * Regression tests for generateMetadata of /course/[id]/lesson/[lessonId].
 *
 * The `[id]` segment is a course id OR a slug: sitemap.xml, canonical links and
 * OG tags are all generated from the slug, while the API layer
 * (resolveLessonAccess, /api/courses/[id]/lessons/[lessonId]) accepts both.
 * Comparing the raw param against lesson.module.courseId made every
 * slug-based lesson URL answer 404.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  notFoundSpy: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  courseFindFirst: vi.fn(),
  courseFindUnique: vi.fn(),
  lessonFindUnique: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFoundSpy,
}));

vi.mock("@/lib/db", () => ({
  db: {
    course: {
      findFirst: mocks.courseFindFirst,
      findUnique: mocks.courseFindUnique,
    },
    lesson: {
      findUnique: mocks.lessonFindUnique,
    },
  },
  Prisma: {},
}));

vi.mock("@/components/StepViewerPage", () => ({
  StepViewerPage: () => null,
}));

import { generateMetadata } from "./page";

const COURSE_UUID = "11111111-1111-4111-8111-111111111111";
const LESSON_UUID = "22222222-2222-4222-8222-222222222222";

function courseRow(overrides: Record<string, unknown> = {}) {
  return { id: COURSE_UUID, slug: "my-course", title: "Курс", ...overrides };
}

function lessonRow(courseId: string, title = "Урок") {
  return {
    id: LESSON_UUID,
    title,
    module: { courseId, course: { title: "Курс" } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  
  mocks.courseFindFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    if (where.id === COURSE_UUID || where.slug === "my-course") return courseRow();
    return null;
  });
  
  mocks.courseFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
    return where.id === COURSE_UUID ? courseRow() : null;
  });
  
  mocks.lessonFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
    return where.id === LESSON_UUID ? lessonRow(COURSE_UUID) : null;
  });
});

describe("generateMetadata for /course/[id]/lesson/[lessonId]", () => {
  it("does not 404 when the param is a slug", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "my-course", lessonId: LESSON_UUID }),
    });

    expect(mocks.notFoundSpy).not.toHaveBeenCalled();
    expect(metadata.title).toContain("Урок");
  });

  it("does not 404 when the param is a course id", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: COURSE_UUID, lessonId: LESSON_UUID }),
    });

    expect(mocks.notFoundSpy).not.toHaveBeenCalled();
    expect(metadata.title).toContain("Урок");
  });

  it("404s when the lesson belongs to a different course", async () => {
    mocks.lessonFindUnique.mockResolvedValue(lessonRow("99999999-9999-4999-8999-999999999999"));

    await expect(
      generateMetadata({
        params: Promise.resolve({ id: "my-course", lessonId: LESSON_UUID }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFoundSpy).toHaveBeenCalled();
  });

  it("404s when the course param matches nothing", async () => {
    await expect(
      generateMetadata({
        params: Promise.resolve({ id: "no-such-course", lessonId: LESSON_UUID }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFoundSpy).toHaveBeenCalled();
  });

  it("404s when the lesson is missing", async () => {
    mocks.lessonFindUnique.mockResolvedValue(null);

    await expect(
      generateMetadata({
        params: Promise.resolve({ id: "my-course", lessonId: LESSON_UUID }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFoundSpy).toHaveBeenCalled();
  });
});
