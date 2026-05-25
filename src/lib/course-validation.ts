import { z } from "zod";

export const lessonSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200).optional(),
  type: z.enum(["text", "video", "coding", "quiz", "assignment"]).optional().default("text"),
  content: z.string().optional(),
  videoUrl: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      try {
        const url = new URL(val);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "videoUrl должен быть корректным http или https URL" }
  ),
  duration: z.union([z.string(), z.number()]).optional(),
  sortOrder: z.number().optional(),
  isFree: z.boolean().optional(),
});

export const moduleSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  sortOrder: z.number().optional(),
  lessons: z.array(lessonSchema).optional(),
});

export const createCourseSchema = z.object({
  title: z.string().min(3, "Название должно быть от 3 до 200 символов").max(200),
  slug: z.string().min(3, "Slug должен быть от 3 до 100 символов").max(100),
  description: z.string().min(10, "Описание должно быть от 10 до 5000 символов").max(5000),
  shortDesc: z.string().max(500, "Краткое описание не должно превышать 500 символов").optional().nullable(),
  price: z.union([z.string(), z.number()]).optional().default(0),
  oldPrice: z.union([z.string(), z.number()]).optional().nullable(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional().default("beginner"),
  duration: z.string().optional().nullable(),
  isPublished: z.boolean().optional().default(false),
  isFeatured: z.boolean().optional().default(false),
  hasCertificate: z.boolean().optional().default(true),
  tags: z.string().optional().nullable(),
  requirements: z.string().optional().nullable(),
  whatYouLearn: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  modules: z.array(moduleSchema).optional().default([]),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  visibility: z.enum(["public", "private"]).optional().default("public"),
  maxStudents: z.union([z.string(), z.number()]).optional().nullable(),
  prerequisites: z.string().optional().nullable(),
  language: z.enum(["ru", "en", "zh"]).optional().default("ru"),
});

export type ModuleInput = {
  id?: string;
  title?: string;
  description?: string;
  sortOrder?: number;
  lessons?: LessonInput[];
};

export type LessonInput = {
  id?: string;
  title?: string;
  type?: string;
  content?: string;
  videoUrl?: string;
  duration?: string | number;
  sortOrder?: number;
  isFree?: boolean;
};

export function validatePrices(price: unknown, oldPrice: unknown): { error: string } | null {
  const parsedPrice = Number(price);
  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    return { error: "Цена должна быть неотрицательным числом" };
  }

  if (oldPrice !== undefined && oldPrice !== null) {
    const parsedOldPrice = Number(oldPrice);
    if (!Number.isFinite(parsedOldPrice) || parsedOldPrice < 0) {
      return { error: "Старая цена должна быть неотрицательным числом" };
    }
  }

  return null;
}
