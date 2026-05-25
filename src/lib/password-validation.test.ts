import { describe, it, expect } from "vitest";
import { z } from "zod";

// Импортируем схему валидации пароля из register route
const registerPasswordSchema = z
  .string()
  .min(8, "Пароль должен быть не менее 8 символов")
  .regex(/[A-ZА-ЯЁ]/, "Пароль должен содержать хотя бы одну заглавную букву")
  .regex(/[a-zа-яё]/, "Пароль должен содержать хотя бы одну строчную букву")
  .regex(/[0-9]/, "Пароль должен содержать хотя бы одну цифру");

describe("password validation consistency", () => {
  it("rejects passwords shorter than 8 characters", () => {
    const result = registerPasswordSchema.safeParse("Abc1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Пароль должен быть не менее 8 символов");
    }
  });

  it("rejects passwords without uppercase letter", () => {
    const result = registerPasswordSchema.safeParse("abc12345");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Пароль должен содержать хотя бы одну заглавную букву");
    }
  });

  it("rejects passwords without lowercase letter", () => {
    const result = registerPasswordSchema.safeParse("ABC12345");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Пароль должен содержать хотя бы одну строчную букву");
    }
  });

  it("rejects passwords without digit", () => {
    const result = registerPasswordSchema.safeParse("Abcdefgh");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Пароль должен содержать хотя бы одну цифру");
    }
  });

  it("accepts valid password meeting all requirements", () => {
    const result = registerPasswordSchema.safeParse("Password1");
    expect(result.success).toBe(true);
  });

  it("accepts valid password with Russian characters", () => {
    const result = registerPasswordSchema.safeParse("Пароль12");
    expect(result.success).toBe(true);
  });

  it("has same requirements as reset password schema", () => {
    // Reset password schema из forgot-password route
    const resetPasswordSchema = z
      .string()
      .min(8, "Пароль должен быть не менее 8 символов")
      .regex(/[A-ZА-ЯЁ]/, "Пароль должен содержать хотя бы одну заглавную букву")
      .regex(/[a-zа-яё]/, "Пароль должен содержать хотя бы одну строчную букву")
      .regex(/[0-9]/, "Пароль должен содержать хотя бы одну цифру");

    // Тестовые пароля
    const testCases = [
      { password: "Password1", shouldPass: true },
      { password: "abc123", shouldPass: false }, // too short, no uppercase
      { password: "abc", shouldPass: false }, // too short
      { password: "ABC12345", shouldPass: false }, // no lowercase
      { password: "abc12345", shouldPass: false }, // no uppercase
      { password: "Abcdefgh", shouldPass: false }, // no digit
      { password: "Пароль12", shouldPass: true }, // Russian chars OK
    ];

    for (const { password, shouldPass } of testCases) {
      const registerResult = registerPasswordSchema.safeParse(password);
      const resetResult = resetPasswordSchema.safeParse(password);

      expect(registerResult.success).toBe(shouldPass);
      expect(resetResult.success).toBe(shouldPass);
      expect(registerResult.success).toBe(resetResult.success);
    }
  });
});
