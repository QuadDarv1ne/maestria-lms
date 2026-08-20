import { z } from "zod";

export const MAX_COMMENT_LENGTH = 2000;

/** Schema for comment content (shared between create and update). */
export const commentContentSchema = z
  .string()
  .trim()
  .min(1, "Комментарий не может быть пустым")
  .max(MAX_COMMENT_LENGTH, `Комментарий слишком длинный (максимум ${MAX_COMMENT_LENGTH} символов)`);
