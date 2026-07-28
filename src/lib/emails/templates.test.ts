import { describe, it, expect } from "vitest";
import {
  welcomeEmail,
  verifyEmailEmail,
  passwordResetEmail,
  coursePurchaseEmail,
  certificateEmail,
  reviewNotificationEmail,
  lessonReminderEmail,
  achievementEmail,
  paymentNotificationEmail,
} from "./templates";

describe("welcomeEmail", () => {
  const result = welcomeEmail("Иван", "https://example.com/dashboard");

  it("includes subject", () => {
    expect(result.subject).toContain("Добро пожаловать");
  });

  it("includes user name in html", () => {
    expect(result.html).toContain("Иван");
  });

  it("includes dashboard url in html", () => {
    expect(result.html).toContain("https://example.com/dashboard");
  });

  it("includes text version", () => {
    expect(result.text).toContain("Иван");
    expect(result.text).toContain("https://example.com/dashboard");
  });

  it("escapes html in user name", () => {
    const r = welcomeEmail("<script>alert('xss')</script>", "https://example.com");
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
  });
});

describe("verifyEmailEmail", () => {
  const result = verifyEmailEmail("Иван", "https://example.com/verify?token=abc");

  it("includes subject", () => {
    expect(result.subject).toContain("Подтверждение email");
  });

  it("includes verification url", () => {
    expect(result.html).toContain("https://example.com/verify?token=abc");
  });

  it("falls back to default name", () => {
    const r = verifyEmailEmail("", "https://example.com");
    expect(r.html).toContain("пользователь");
  });
});

describe("passwordResetEmail", () => {
  const result = passwordResetEmail("https://example.com/reset?code=abc");

  it("includes subject", () => {
    expect(result.subject).toContain("Сброс пароля");
  });

  it("includes reset url", () => {
    expect(result.html).toContain("https://example.com/reset?code=abc");
    expect(result.text).toContain("https://example.com/reset?code=abc");
  });
});

describe("coursePurchaseEmail", () => {
  const result = coursePurchaseEmail("Иван", "Python Pro", "https://example.com/course/1");

  it("includes subject with course name", () => {
    expect(result.subject).toContain("Python Pro");
  });

  it("includes course name in body", () => {
    expect(result.html).toContain("Python Pro");
    expect(result.html).toContain("https://example.com/course/1");
  });
});

describe("certificateEmail", () => {
  const result = certificateEmail("Иван", "Python Pro", "https://example.com/certificate/1");

  it("includes subject with course name", () => {
    expect(result.subject).toContain("Сертификат");
    expect(result.subject).toContain("Python Pro");
  });

  it("includes certificate url", () => {
    expect(result.html).toContain("https://example.com/certificate/1");
  });
});

describe("reviewNotificationEmail", () => {
  const result = reviewNotificationEmail("Иван", "Python Pro", "https://example.com/review/1");

  it("includes subject", () => {
    expect(result.subject).toContain("Новая оценка");
  });

  it("includes review url", () => {
    expect(result.html).toContain("https://example.com/review/1");
  });
});

describe("lessonReminderEmail", () => {
  const result = lessonReminderEmail("Иван", "Python Pro", "https://example.com/course/1", "Введение");

  it("includes subject with lesson title", () => {
    expect(result.subject).toContain("Введение");
  });

  it("includes lesson and course names", () => {
    expect(result.html).toContain("Введение");
    expect(result.html).toContain("Python Pro");
  });
});

describe("achievementEmail", () => {
  const result = achievementEmail("Иван", "Быстрый старт", "https://example.com/achievements");

  it("includes subject", () => {
    expect(result.subject).toContain("Быстрый старт");
  });

  it("includes achievement name in body", () => {
    expect(result.html).toContain("Быстрый старт");
  });
});

describe("paymentNotificationEmail", () => {
  const result = paymentNotificationEmail("Иван", "Python Pro", "4 990 ₽", "https://example.com/course/1");

  it("includes subject", () => {
    expect(result.subject).toContain("Оплата");
  });

  it("includes amount and course name", () => {
    expect(result.html).toContain("4 990 ₽");
    expect(result.html).toContain("Python Pro");
  });

  it("includes course url", () => {
    expect(result.html).toContain("https://example.com/course/1");
  });
});

describe("email templates", () => {
  it("all templates return valid structure", () => {
    const templates = [
      welcomeEmail("Test", "https://example.com"),
      verifyEmailEmail("Test", "https://example.com"),
      passwordResetEmail("https://example.com"),
      coursePurchaseEmail("Test", "Course", "https://example.com"),
      certificateEmail("Test", "Course", "https://example.com"),
      reviewNotificationEmail("Test", "Course", "https://example.com"),
      lessonReminderEmail("Test", "Course", "https://example.com", "Lesson"),
      achievementEmail("Test", "Achievement", "https://example.com"),
      paymentNotificationEmail("Test", "Course", "100 ₽", "https://example.com"),
    ];

    for (const t of templates) {
      expect(t).toHaveProperty("subject");
      expect(t).toHaveProperty("html");
      expect(t).toHaveProperty("text");
      expect(typeof t.subject).toBe("string");
      expect(t.subject.length).toBeGreaterThan(0);
      expect(typeof t.html).toBe("string");
      expect(t.html.length).toBeGreaterThan(0);
      expect(t.html).toContain("<!DOCTYPE html>");
      expect(t.html).toContain("</html>");
      expect(typeof t.text).toBe("string");
      expect(t.text.length).toBeGreaterThan(0);
    }
  });
});
