import sanitizeHtml from "sanitize-html";

const DEFAULT_ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "strong", "em", "u", "s", "mark", "sub", "sup",
  "blockquote", "pre", "code",
  "ul", "ol", "li",
  "a",
  "img",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "dl", "dt", "dd",
  "div", "span",
  "section", "article", "header", "footer", "nav", "main",
  "details", "summary",
  "abbr", "cite", "q",
  "video", "audio", "source",
];

const DEFAULT_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "name", "target", "rel", "title"],
  img: ["src", "srcset", "alt", "width", "height", "loading"],
  video: ["src", "controls", "autoplay", "loop", "muted", "poster", "width", "height"],
  audio: ["src", "controls", "autoplay", "loop", "muted"],
  source: ["src", "type"],
  code: ["class"],
  pre: ["class"],
  th: ["scope", "rowspan", "colspan"],
  td: ["rowspan", "colspan"],
  "*": ["id", "class", "title", "data-*", "aria-*", "role"],
};

/**
 * Sanitize HTML content, stripping dangerous tags and attributes.
 * Use for rich text fields like course descriptions, lesson content, etc.
 */
export function sanitizeContent(
  html: string,
  options?: {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
  }
): string {
  return sanitizeHtml(html, {
    allowedTags: options?.allowedTags ?? DEFAULT_ALLOWED_TAGS,
    allowedAttributes: options?.allowedAttributes ?? DEFAULT_ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src", "srcset", "poster"],
    allowProtocolRelative: false,
    enforceHtmlBoundary: false,
  });
}

/**
 * Sanitize plain text input — strip all HTML tags and dangerous content.
 * Use for user names, titles, short descriptions, search queries, etc.
 */
export function sanitizeText(input: string, maxLength = 500): string {
  if (!input) return "";
  // Strip HTML tags
  const stripped = input.replace(/<[^>]*>/g, "");
  // Remove control characters (except newlines and tabs)
  const cleaned = stripped.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Trim whitespace
  const trimmed = cleaned.trim();
  // Truncate to max length
  return trimmed.slice(0, maxLength);
}

/**
 * Sanitize a string for safe use in URLs/slugs.
 * Removes special characters, keeps alphanumeric, hyphens, underscores.
 */
export function sanitizeSlug(input: string): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

/**
 * Sanitize email address — trim, lowercase, remove dangerous characters.
 */
export function sanitizeEmail(input: string): string {
  if (!input) return "";
  return input.trim().toLowerCase().replace(/[<>()\[\]\\,;:\"\x00-\x1F\x7F]/g, "");
}

/**
 * Sanitize a phone number — keep only digits, +, -, (, ), spaces.
 */
export function sanitizePhone(input: string): string {
  if (!input) return "";
  return input.replace(/[^0-9+\-()\s]/g, "").trim().slice(0, 20);
}

/**
 * Sanitize a URL — validate and clean.
 */
export function sanitizeUrl(input: string): string {
  if (!input) return "";
  const trimmed = input.trim().slice(0, 2048);
  try {
    const url = new URL(trimmed);
    // Only allow http and https
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

/**
 * Sanitize an object's string fields recursively.
 * Useful for sanitizing entire request bodies before processing.
 */
export function sanitizeObject(
  obj: Record<string, unknown>,
  options?: {
    textFields?: string[];
    htmlFields?: string[];
    skipFields?: string[];
  }
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const textFields = options?.textFields ?? [];
  const htmlFields = options?.htmlFields ?? [];
  const skipFields = options?.skipFields ?? [];

  for (const key of Object.keys(obj)) {
    if (skipFields.includes(key)) {
      result[key] = obj[key];
      continue;
    }

    const value = obj[key];

    if (typeof value === "string") {
      if (htmlFields.includes(key)) {
        result[key] = sanitizeContent(value);
      } else if (textFields.includes(key)) {
        result[key] = sanitizeText(value);
      } else {
        // Default: sanitize as plain text for unknown string fields
        result[key] = sanitizeText(value);
      }
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (typeof item === "string") {
          return sanitizeText(item);
        }
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return sanitizeObject(item as Record<string, unknown>, options);
        }
        return item;
      });
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeObject(
        value as Record<string, unknown>,
        options
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}
