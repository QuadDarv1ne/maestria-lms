import { z } from "zod";

/**
 * Password strength requirements:
 * - At least 8 characters
 * - At least one uppercase letter (including Russian)
 * - At least one lowercase letter (including Russian)
 * - At least one digit
 */
export const passwordStrengthSchema = z
  .string()
  .min(8, "Пароль должен быть не менее 8 символов")
  .regex(/[A-ZА-ЯЁ]/, "Пароль должен содержать хотя бы одну заглавную букву")
  .regex(/[a-zа-яё]/, "Пароль должен содержать хотя бы одну строчную букву")
  .regex(/[0-9]/, "Пароль должен содержать хотя бы одну цифру");
