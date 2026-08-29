import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { promoCourseIds } from "@/lib/promo-courses";

const messagesDir = join(process.cwd(), "src", "lib", "locales");
const imagesDir = join(process.cwd(), "public", "courses");

function loadMessages(locale: string): Record<string, string> {
  return JSON.parse(readFileSync(join(messagesDir, `${locale}.json`), "utf-8"));
}

function getByPath(messages: Record<string, string>, key: string): string | undefined {
  return messages[key];
}

const locales = [
  { name: "ru", messages: loadMessages("ru") },
  { name: "en", messages: loadMessages("en") },
  { name: "zh", messages: loadMessages("zh") },
];

describe("promo-courses data integrity", () => {
  it("has unique ids", () => {
    const ids = promoCourseIds.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("references valid stepik URLs", () => {
    for (const course of promoCourseIds) {
      expect(course.url, `id ${course.id}`).toMatch(/^https:\/\/stepik\.org\/a\/\d+$/);
    }
  });

  it("has ratings within [0, 5] and non-empty images", () => {
    for (const course of promoCourseIds) {
      expect(course.rating, `id ${course.id}`).toBeGreaterThanOrEqual(0);
      expect(course.rating, `id ${course.id}`).toBeLessThanOrEqual(5);
      expect(course.image.length, `id ${course.id}`).toBeGreaterThan(0);
    }
  });

  it("has non-empty i18n title/description/tag/duration keys in all locales", () => {
    for (const locale of locales) {
      for (const course of promoCourseIds) {
        for (const field of ["title", "description", "tag", "duration"] as const) {
          const key = `promo.course.${course.id}.${field}`;
          const value = getByPath(locale.messages, key);
          expect(value, `${key} (${locale.name})`).toBeDefined();
          expect((value ?? "").trim().length, `${key} (${locale.name})`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("has levelKey present in all locales", () => {
    for (const locale of locales) {
      for (const course of promoCourseIds) {
        expect(
          getByPath(locale.messages, course.levelKey)?.trim().length,
          `${course.levelKey} (${locale.name})`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("references images that exist in public/courses", () => {
    for (const course of promoCourseIds) {
      const fileName = course.image.replace(/^\/courses\//, "");
      expect(existsSync(join(imagesDir, fileName)), `image "${course.image}" (id ${course.id})`).toBe(true);
    }
  });
});