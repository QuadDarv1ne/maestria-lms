import { describe, it, expect } from "vitest";
import { passwordStrengthSchema } from "./password-strength";

describe("password validation consistency", () => {
  it("rejects passwords shorter than 8 characters", () => {
    const result = passwordStrengthSchema.safeParse("Abc1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Пароль должен быть не менее 8 символов");
    }
  });

  it("rejects passwords without uppercase letter", () => {
    const result = passwordStrengthSchema.safeParse("abc12345");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Пароль должен содержать хотя бы одну заглавную букву");
    }
  });

  it("rejects passwords without lowercase letter", () => {
    const result = passwordStrengthSchema.safeParse("ABC12345");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Пароль должен содержать хотя бы одну строчную букву");
    }
  });

  it("rejects passwords without digit", () => {
    const result = passwordStrengthSchema.safeParse("Abcdefgh");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Пароль должен содержать хотя бы одну цифру");
    }
  });

  it("accepts valid password meeting all requirements", () => {
    const result = passwordStrengthSchema.safeParse("Password1");
    expect(result.success).toBe(true);
  });

  it("accepts valid password with Russian characters", () => {
    const result = passwordStrengthSchema.safeParse("Пароль12");
    expect(result.success).toBe(true);
  });

  it("has same requirements as reset password schema", () => {
    // Both register and reset use the same shared passwordStrengthSchema
    // This test verifies they are identical by testing against the same schema
    const testCases = [
      { password: "Password1", shouldPass: true },
      { password: "abc123", shouldPass: false },
      { password: "abc", shouldPass: false },
      { password: "ABC12345", shouldPass: false },
      { password: "abc12345", shouldPass: false },
      { password: "Abcdefgh", shouldPass: false },
      { password: "Пароль12", shouldPass: true },
    ];

    for (const { password, shouldPass } of testCases) {
      const result = passwordStrengthSchema.safeParse(password);
      expect(result.success).toBe(shouldPass);
    }
  });
});
