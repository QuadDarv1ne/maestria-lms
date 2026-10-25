import sanitizeHtml from "sanitize-html";
import { ALLOWED_EMBED_HOSTS } from "@/lib/video-embed";

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

const IFRAME_ALLOWED_ATTRIBUTES = [
  "src", "width", "height", "title", "allow", "allowfullscreen",
  "frameborder", "loading", "referrerpolicy",
];

export interface SanitizeContentOptions {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  /** Разрешить встраивание видео с известных хостингов (YouTube, VK, Rutube, …). */
  allowIframes?: boolean;
  /** Открывать внешние ссылки в новой вкладке с rel="noopener noreferrer". */
  externalLinks?: boolean;
  /** Добавлять loading="lazy"/decoding="async" к изображениям. */
  lazyImages?: boolean;
}

/**
 * Sanitize HTML content, stripping dangerous tags and attributes.
 * Use for rich text fields like course descriptions, lesson content, etc.
 */
export function sanitizeContent(
  html: string,
  options?: SanitizeContentOptions
): string {
  const allowIframes = options?.allowIframes ?? false;
  const baseTags = options?.allowedTags ?? DEFAULT_ALLOWED_TAGS;
  const baseAttributes = {
    ...DEFAULT_ALLOWED_ATTRIBUTES,
    ...(options?.allowedAttributes ?? {}),
  };

  const allowedTags = allowIframes
    ? Array.from(new Set([...baseTags, "iframe"]))
    : baseTags;
  const allowedAttributes = allowIframes
    ? { ...baseAttributes, iframe: IFRAME_ALLOWED_ATTRIBUTES }
    : baseAttributes;

  const transformTags: sanitizeHtml.Transformer = {};

  if (options?.externalLinks) {
    transformTags.a = (tagName: string, attribs: Record<string, string>) => {
      const href = attribs.href ?? "";
      const isExternal = /^https?:\/\//i.test(href) && !href.startsWith("/");
      if (!isExternal) return { tagName, attribs };
      return {
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      };
    };
  }

  if (options?.lazyImages) {
    transformTags.img = (tagName: string, attribs: Record<string, string>) => ({
      tagName,
      attribs: {
        ...attribs,
        loading: attribs.loading || "lazy",
        decoding: attribs.decoding || "async",
      },
    });
  }

  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedIframeHostnames: allowIframes ? ALLOWED_EMBED_HOSTS : undefined,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src", "srcset", "poster"],
    allowProtocolRelative: false,
    enforceHtmlBoundary: false,
    ...(Object.keys(transformTags).length > 0 ? { transformTags } : {}),
  });
}

/**
 * Sanitize plain text input — strip all HTML tags and dangerous content.
 * Use for user names, titles, short descriptions, search queries, etc.
 */
export function sanitizeText(input: string, maxLength = 500): string {
  if (!input) return "";
  // Strip all HTML tags and their content for script, style, iframe, object, embed
  let stripped = input.replace(/<script[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  stripped = stripped.replace(/<style[^>]*>[\s\S]*?<\/style\s*>/gi, "");
  stripped = stripped.replace(/<iframe[^>]*>[\s\S]*?<\/iframe\s*>/gi, "");
  stripped = stripped.replace(/<object[^>]*>[\s\S]*?<\/object\s*>/gi, "");
  stripped = stripped.replace(/<embed[^>]*>[\s\S]*?<\/embed\s*>/gi, "");
  stripped = stripped.replace(/<noscript[^>]*>[\s\S]*?<\/noscript\s*>/gi, "");
  // Strip remaining HTML tags (keep content)
  stripped = stripped.replace(/<[^>]*>/g, "");
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
  return input.trim().toLowerCase().replace(/[<>()\],;:[\x00-\x1F\x7F]/g, "");
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
        options, // pass options to nested calls
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}
