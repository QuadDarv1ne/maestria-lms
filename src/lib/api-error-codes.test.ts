import { describe, it, expect } from "vitest";
import { apiErrorMessage, apiErrorCode, API_ERROR_MESSAGES } from "./api-error-codes";

describe("apiErrorMessage", () => {
  it("resolves by explicit code in every locale", () => {
    const body = { error: "Курс не найден", code: "course_not_found" };
    expect(apiErrorMessage(body, "ru")).toBe("Курс не найден");
    expect(apiErrorMessage(body, "en")).toBe("Course not found");
    expect(apiErrorMessage(body, "zh")).toBe("课程不存在");
  });

  it("resolves legacy Russian-only messages by exact match", () => {
    expect(apiErrorMessage({ error: "Курс не найден" }, "en")).toBe("Course not found");
    expect(apiErrorMessage({ error: "Ошибка валидации" }, "zh")).toBe("校验失败");
    expect(apiErrorMessage({ error: "Неверный пароль" }, "ru")).toBe("Неверный пароль");
  });

  it("returns the raw server message when it is unknown", () => {
    expect(apiErrorMessage({ error: "Какое-то новое сообщение" }, "en")).toBe("Какое-то новое сообщение");
  });

  it("falls back to the provided i18n key when body has no error", () => {
    // "common.error" exists in all locales; a missing key returns the key itself
    expect(apiErrorMessage({}, "en", "common.error")).toBe("Error");
    expect(apiErrorMessage(null, "en", "no.such.key")).toBe("no.such.key");
    expect(apiErrorMessage(undefined, "ru", "no.such.key")).toBe("no.such.key");
  });

  it("falls back to common.error when no error and no fallback key", () => {
    expect(apiErrorMessage(null, "en")).toBe("Error");
  });

  it("ignores non-string error fields", () => {
    expect(apiErrorMessage({ error: 42 }, "en", "common.error")).toBe("Error");
  });

  it("prefers code over exact message match", () => {
    // Deliberately inconsistent: code wins even if the text differs
    expect(apiErrorMessage({ error: "Ошибка валидации", code: "wrong_password" }, "en"))
      .toBe(API_ERROR_MESSAGES.wrong_password.en);
  });
});

describe("apiErrorCode", () => {
  it("returns the code from a response body", () => {
    expect(apiErrorCode({ code: "course_not_found" })).toBe("course_not_found");
  });

  it("returns null for bodies without a code", () => {
    expect(apiErrorCode({ error: "oops" })).toBeNull();
    expect(apiErrorCode(null)).toBeNull();
    expect(apiErrorCode("string body")).toBeNull();
  });
});

describe("catalog integrity", () => {
  it("has unique codes", () => {
    const codes = Object.keys(API_ERROR_MESSAGES);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every entry has non-empty ru/en/zh messages", () => {
    for (const entry of Object.values(API_ERROR_MESSAGES)) {
      expect(entry.ru.length).toBeGreaterThan(0);
      expect(entry.en.length).toBeGreaterThan(0);
      expect(entry.zh.length).toBeGreaterThan(0);
    }
  });
});
