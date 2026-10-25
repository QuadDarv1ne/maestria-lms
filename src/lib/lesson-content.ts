import { sanitizeContent } from "@/lib/sanitize";

export type ContentFormat = "html" | "markdown" | "plain";

/**
 * Блочные HTML-теги, по которым понимаем, что автор (или импорт из Stepik)
 * прислал разметку, а не markdown/простой текст.
 */
const HTML_TAG_RE =
  /<\/?(?:p|div|h[1-6]|ul|ol|li|table|thead|tbody|tfoot|tr|th|td|blockquote|pre|code|img|figure|figcaption|section|article|details|summary|iframe|video|audio|source|br|hr|dl|dt|dd)\b[^>]*>/i;

const MARKDOWN_RE = new RegExp(
  [
    "^\\s{0,3}#{1,6}\\s+\\S", // заголовки
    "^\\s{0,3}(?:[-*+]|\\d+\\.)\\s+\\S", // списки
    "^\\s{0,3}>\\s+\\S", // цитаты
    "^\\s{0,3}```", // блоки кода
    "^\\s{0,3}\\|.+\\|\\s*$", // таблицы GFM
    "!\\[[^\\]]*\\]\\([^)]+\\)", // изображения
    "\\[[^\\]]+\\]\\([^)]+\\)", // ссылки
    "\\*\\*[^*]+\\*\\*", // жирный
  ].join("|"),
  "m",
);

/**
 * Определяет формат учебного контента.
 * HTML имеет приоритет: импортированные курсы приходят с готовой разметкой.
 */
export function detectContentFormat(raw: string | null | undefined): ContentFormat {
  const value = (raw ?? "").trim();
  if (!value) return "plain";
  if (HTML_TAG_RE.test(value)) return "html";
  if (MARKDOWN_RE.test(value)) return "markdown";
  return "plain";
}

/**
 * Готовит HTML урока к безопасному выводу:
 * санитизация, разрешённые видео-iframe, ленивые изображения,
 * внешние ссылки в новой вкладке.
 */
export function prepareLessonHtml(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  return sanitizeContent(value, {
    allowIframes: true,
    externalLinks: true,
    lazyImages: true,
  });
}

/** Убирает теги и служебные элементы, оставляя читаемый текст. */
export function htmlToPlainText(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  return value
    .replace(/<(script|style|noscript|template)[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|pre)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Оценка времени чтения в минутах (200 слов/мин; для CJK — 500 символов/мин).
 * Возвращает минимум 1 минуту для непустого контента.
 */
export function estimateReadingMinutes(raw: string | null | undefined): number {
  const text = htmlToPlainText(raw);
  if (!text) return 0;

  const words = text.split(/\s+/).filter(Boolean).length;
  if (words >= 20) return Math.max(1, Math.round(words / 200));

  const cjkChars = (text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
  if (cjkChars >= 50) return Math.max(1, Math.round(cjkChars / 500));

  return 1;
}
