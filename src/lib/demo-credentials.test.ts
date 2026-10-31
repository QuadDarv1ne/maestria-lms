import { describe, it, expect } from "vitest";
import {
  GENERATED_PASSWORD_LENGTH,
  MIN_GENERATED_PASSWORD_LENGTH,
  checkSeedPasswordStrength,
  generateStrongPassword,
  resolveSeedPassword,
} from "@/lib/demo-credentials";
import { passwordStrengthSchema } from "@/lib/password-strength";

describe("generateStrongPassword", () => {
  it("satisfies the registration password policy", () => {
    for (let i = 0; i < 25; i += 1) {
      expect(passwordStrengthSchema.safeParse(generateStrongPassword()).success).toBe(true);
    }
  });

  it("always contains every required character class", () => {
    for (let i = 0; i < 25; i += 1) {
      const password = generateStrongPassword();
      expect(password).toMatch(/[A-ZА-ЯЁ]/);
      expect(password).toMatch(/[a-zа-яё]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it("uses the requested length", () => {
    expect(generateStrongPassword()).toHaveLength(GENERATED_PASSWORD_LENGTH);
    expect(generateStrongPassword(32)).toHaveLength(32);
  });

  it("rejects lengths below the safety floor", () => {
    expect(() => generateStrongPassword(MIN_GENERATED_PASSWORD_LENGTH - 1)).toThrow();
    expect(() => generateStrongPassword(0)).toThrow();
  });

  it("does not repeat itself", () => {
    const generated = new Set(Array.from({ length: 100 }, () => generateStrongPassword()));
    expect(generated.size).toBe(100);
  });
});

describe("checkSeedPasswordStrength", () => {
  it("accepts a generated password", () => {
    expect(checkSeedPasswordStrength(generateStrongPassword())).toBeNull();
  });

  it("rejects the passwords this repository used to ship", () => {
    for (const weak of ["demo123", "admin123", "teacher123", "password"]) {
      expect(checkSeedPasswordStrength(weak), weak).not.toBeNull();
    }
  });

  it("rejects short passwords even when they mix classes", () => {
    expect(checkSeedPasswordStrength("Ab3!")).not.toBeNull();
  });

  it("rejects a long password without digits", () => {
    expect(checkSeedPasswordStrength("abcdefghijklmnopqrst")).not.toBeNull();
  });
});

describe("resolveSeedPassword", () => {
  it("uses a strong password from the environment", () => {
    const strong = generateStrongPassword();
    expect(resolveSeedPassword({ envValue: strong, label: "SEED_X" })).toEqual({
      password: strong,
      source: "env",
    });
  });

  it("generates one when the environment is empty", () => {
    const resolved = resolveSeedPassword({ envValue: undefined, label: "SEED_X" });
    expect(resolved.source).toBe("generated");
    expect(checkSeedPasswordStrength(resolved.password)).toBeNull();
  });

  it("refuses a weak password instead of silently seeding it", () => {
    expect(() => resolveSeedPassword({ envValue: "demo123", label: "SEED_X" })).toThrow(
      /SEED_X is not strong enough/,
    );
  });
});
