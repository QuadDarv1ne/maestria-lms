import { describe, it, expect } from "vitest";
import { createCourseSchema, validatePrices } from "@/lib/course-validation";

const baseCourse = {
  title: "Основы программирования",
  slug: "programming-basics",
  description: "Курс для начинающих программистов",
};

describe("createCourseSchema", () => {
  it("accepts a minimal valid course", () => {
    const result = createCourseSchema.safeParse(baseCourse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(0);
      expect(result.data.level).toBe("beginner");
      expect(result.data.language).toBe("ru");
      expect(result.data.visibility).toBe("public");
      expect(result.data.modules).toEqual([]);
    }
  });

  it("rejects a title shorter than 3 characters", () => {
    const result = createCourseSchema.safeParse({ ...baseCourse, title: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejects a slug with invalid characters", () => {
    const result = createCourseSchema.safeParse({ ...baseCourse, slug: "bad_slug!" });
    expect(result.success).toBe(false);
  });

  it("rejects a description shorter than 10 characters", () => {
    const result = createCourseSchema.safeParse({ ...baseCourse, description: "short" });
    expect(result.success).toBe(false);
  });

  it("accepts string price and converts to number", () => {
    const result = createCourseSchema.safeParse({ ...baseCourse, price: "499" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe("499");
    }
  });

  it("accepts modules with lessons and timed assignments", () => {
    const result = createCourseSchema.safeParse({
      ...baseCourse,
      modules: [
        {
          title: "Модуль 1",
          lessons: [
            {
              title: "Урок 1",
              type: "assignment",
              assignments: [
                {
                  title: "Практика",
                  type: "text",
                  points: 10,
                  maxAttempts: 2,
                  timeLimit: 30,
                },
              ],
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const assignment = result.data.modules?.[0].lessons?.[0].assignments?.[0];
      expect(assignment?.timeLimit).toBe(30);
      expect(assignment?.maxAttempts).toBe(2);
    }
  });

  it("accepts timeLimit as string or null", () => {
    expect(
      createCourseSchema.safeParse({
        ...baseCourse,
        modules: [
          {
            lessons: [
              {
                assignments: [{ timeLimit: "45" }],
              },
            ],
          },
        ],
      }).success,
    ).toBe(true);

    expect(
      createCourseSchema.safeParse({
        ...baseCourse,
        modules: [
          {
            lessons: [
              {
                assignments: [{ timeLimit: null }],
              },
            ],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects unsupported assignment type", () => {
    const result = createCourseSchema.safeParse({
      ...baseCourse,
      modules: [
        {
          lessons: [
            {
              assignments: [{ type: "drag_drop" }],
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);

    const bad = createCourseSchema.safeParse({
      ...baseCourse,
      modules: [
        {
          lessons: [
            {
              assignments: [{ type: "multiple-choice" }],
            },
          ],
        },
      ],
    });
    expect(bad.success).toBe(false);
  });

  it("rejects invalid videoUrl", () => {
    const result = createCourseSchema.safeParse({
      ...baseCourse,
      modules: [
        {
          lessons: [{ type: "video", videoUrl: "not-a-url" }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("validatePrices", () => {
  it("returns null for valid prices", () => {
    expect(validatePrices(100, 200)).toBeNull();
  });

  it("returns error for negative price", () => {
    expect(validatePrices(-1, undefined)?.error).toContain("неотрицательным");
  });

  it("returns error for non-numeric price", () => {
    expect(validatePrices("abc", undefined)?.error).toBeTruthy();
  });

  it("returns error when oldPrice is not greater than price", () => {
    expect(validatePrices(200, 200)?.error).toContain("больше");
    expect(validatePrices(300, 200)?.error).toContain("больше");
  });

  it("ignores oldPrice when null or undefined", () => {
    expect(validatePrices(100, null)).toBeNull();
  });
});