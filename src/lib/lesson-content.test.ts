import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sanitizeContent: vi.fn((value: string) => `SANITIZED:${value}`),
}));

vi.mock("@/lib/sanitize", () => ({
  sanitizeContent: mocks.sanitizeContent,
}));

import {
  detectContentFormat,
  estimateReadingMinutes,
  htmlToPlainText,
  prepareLessonHtml,
} from "./lesson-content";

beforeEach(() => {
  mocks.sanitizeContent.mockClear();
});

describe("detectContentFormat", () => {
  it("null/undefined/пустая строка → plain", () => {
    expect(detectContentFormat(null)).toBe("plain");
    expect(detectContentFormat(undefined)).toBe("plain");
    expect(detectContentFormat("")).toBe("plain");
    expect(detectContentFormat("   \n  ")).toBe("plain");
  });

  it("HTML-теги распознаются (в т.ч. заглавные и с атрибутами)", () => {
    expect(detectContentFormat("<p>Привет</p>")).toBe("html");
    expect(detectContentFormat('<DIV class="x">текст</DIV>')).toBe("html");
    expect(detectContentFormat("<h2 id='a'>Заголовок</h2>")).toBe("html");
    expect(detectContentFormat("текст<br/>ещё текст")).toBe("html");
    expect(detectContentFormat('<img src="a.png" alt="">')).toBe("html");
    expect(detectContentFormat("<iframe src='https://x'></iframe>")).toBe("html");
  });

  it("HTML имеет приоритет над markdown", () => {
    expect(detectContentFormat("# Заголовок\n<p>и абзац</p>")).toBe("html");
  });

  it("markdown: заголовки", () => {
    expect(detectContentFormat("## Раздел")).toBe("markdown");
  });

  it("markdown: списки (маркеры и нумерованные)", () => {
    expect(detectContentFormat("- пункт")).toBe("markdown");
    expect(detectContentFormat("* пункт")).toBe("markdown");
    expect(detectContentFormat("1. шаг")).toBe("markdown");
  });

  it("markdown: цитаты, код, таблицы", () => {
    expect(detectContentFormat("> цитата")).toBe("markdown");
    expect(detectContentFormat("```js\ncode();\n```")).toBe("markdown");
    expect(detectContentFormat("| a | b |\n| c | d |")).toBe("markdown");
  });

  it("markdown: ссылки, изображения, жирный", () => {
    expect(detectContentFormat("[текст](https://example.com)")).toBe("markdown");
    expect(detectContentFormat("![alt](https://example.com/i.png)")).toBe("markdown");
    expect(detectContentFormat("очень **важно**")).toBe("markdown");
  });

  it("обычный текст → plain", () => {
    expect(detectContentFormat("Просто текст без разметки")).toBe("plain");
    expect(detectContentFormat("Вопрос без двоеточия?")).toBe("plain");
    expect(detectContentFormat("Слово с звёздочкой * отдельно")).toBe("plain");
  });
});

describe("prepareLessonHtml", () => {
  it("пустой ввод → пустая строка без вызова санитайзера", () => {
    expect(prepareLessonHtml(null)).toBe("");
    expect(prepareLessonHtml(undefined)).toBe("");
    expect(prepareLessonHtml("   ")).toBe("");
    expect(mocks.sanitizeContent).not.toHaveBeenCalled();
  });

  it("делегирует в sanitizeContent с настройками для уроков", () => {
    const result = prepareLessonHtml("<p>Контент</p>");
    expect(result).toBe("SANITIZED:<p>Контент</p>");
    expect(mocks.sanitizeContent).toHaveBeenCalledWith("<p>Контент</p>", {
      allowIframes: true,
      externalLinks: true,
      lazyImages: true,
    });
  });
});

describe("htmlToPlainText", () => {
  it("пустой ввод → пустая строка", () => {
    expect(htmlToPlainText("")).toBe("");
    expect(htmlToPlainText(null)).toBe("");
  });

  it("убирает содержимое script/style/template", () => {
    expect(htmlToPlainText("<p>Текст</p><script>alert(1)</script>")).toBe("Текст");
    expect(htmlToPlainText("<style>.x{}</style><p>Текст</p>")).toBe("Текст");
  });

  it("<br> → перевод строки", () => {
    expect(htmlToPlainText("<p>Строка 1<br>Строка 2</p>")).toBe("Строка 1\nСтрока 2");
  });

  it("закрывающие блоки → перевод строки", () => {
    expect(htmlToPlainText("<p>Строка 1</p><p>Строка 2</p>")).toBe("Строка 1\n Строка 2");
  });

  it("инлайн-теги заменяются пробелом", () => {
    expect(htmlToPlainText("<b>жирный</b>текст")).toBe("жирный текст");
  });

  it("HTML-сущности декодируются", () => {
    // Строки с сущностями собираются конкатенацией, чтобы сохранить буквально "<" и т.п.
    const nbsp = "&" + "nbsp;";
    const amp = "&" + "amp;";
    const lt = "&" + "lt;";
    const gt = "&" + "gt;";
    const quot = "&" + "quot;";
    const apos = "&" + "#39;";

    expect(htmlToPlainText(`<p>A${nbsp}${amp}${nbsp}B</p>`)).toBe("A & B");
    expect(htmlToPlainText(`<p>${lt}tag${gt} ${quot}q${quot} ${apos}ok${apos}</p>`)).toBe(
      '<tag> "q" \'ok\''
    );
  });

  it("схлопывает лишние пробелы и пустые строки", () => {
    // Пустые абзацы дают переводы строк (с оставшимися пробелами от инлайн-тегов)
    expect(htmlToPlainText("<p>А</p><p></p><p></p><p>Б</p>")).toBe("А\n \n \n Б");
    expect(htmlToPlainText("<p>слишком    много    пробелов</p>")).toBe(
      "слишком много пробелов"
    );
  });
});

describe("estimateReadingMinutes", () => {
  it("пустой контент → 0", () => {
    expect(estimateReadingMinutes("")).toBe(0);
    expect(estimateReadingMinutes("<p></p>")).toBe(0);
    expect(estimateReadingMinutes(null)).toBe(0);
  });

  it("короткий текст → минимум 1 минута", () => {
    expect(estimateReadingMinutes("<p>Немного слов</p>")).toBe(1);
  });

  it("200 слов → 1 минута, 1000 слов → 5 минут", () => {
    const words200 = Array.from({ length: 200 }, (_, i) => `слово${i}`).join(" ");
    expect(estimateReadingMinutes(words200)).toBe(1);
    const words1000 = Array.from({ length: 1000 }, (_, i) => `слово${i}`).join(" ");
    expect(estimateReadingMinutes(words1000)).toBe(5);
  });

  it("HTML-разметка не считается словами", () => {
    const text = Array.from({ length: 100 }, (_, i) => `слово${i}`).join(" ");
    expect(estimateReadingMinutes(`<p>${text}</p>`)).toBe(1);
  });

  it("CJK-текст считается по символам (500/мин)", () => {
    const cjk = "学".repeat(1000);
    expect(estimateReadingMinutes(cjk)).toBe(2);
  });
});
