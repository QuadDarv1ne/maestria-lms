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
  "iframe",
];

const DEFAULT_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "name", "target", "rel", "title"],
  img: ["src", "srcset", "alt", "width", "height", "loading"],
  video: ["src", "controls", "autoplay", "loop", "muted", "poster", "width", "height"],
  audio: ["src", "controls", "autoplay", "loop", "muted"],
  source: ["src", "type"],
  iframe: ["src", "width", "height", "frameborder", "allow", "allowfullscreen", "sandbox", "title"],
  code: ["class"],
  pre: ["class"],
  th: ["scope", "rowspan", "colspan"],
  td: ["rowspan", "colspan"],
  "*": ["id", "class", "style", "title", "data-*", "aria-*", "role"],
};

export function sanitizeContent(html: string, options?: { allowedTags?: string[]; allowedAttributes?: Record<string, string[]> }): string {
  return sanitizeHtml(html, {
    allowedTags: options?.allowedTags ?? DEFAULT_ALLOWED_TAGS,
    allowedAttributes: options?.allowedAttributes ?? DEFAULT_ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { iframe: ["http", "https"] },
    allowedSchemesAppliedToAttributes: ["href", "src", "srcset", "poster"],
    allowProtocolRelative: false,
    enforceHtmlBoundary: false,
  });
}
