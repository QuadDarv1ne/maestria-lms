/**
 * HTML-to-Markdown converter for VK articles.
 * Converts VK's article HTML to clean Markdown preserving:
 * - Headings, bold, italic, strikethrough
 * - Paragraphs, line breaks
 * - Ordered and unordered lists
 * - Tables
 * - Links and images (with absolute URLs)
 * - Blockquotes and code blocks
 * - Embedded media (videos, maps, polls)
 */

import { JSDOM } from "jsdom";

/**
 * Convert a VK article HTML string to Markdown.
 * @param {string} html - Raw HTML from VK article layer
 * @returns {string} Markdown text
 */
export function vkHtmlToMarkdown(html) {
  if (!html || typeof html !== "string") return "";

  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`);
  const body = dom.window.document.body;

  // Clean up the document first
  cleanDocument(body);

  const result = convertNodes(body);
  let md = result.trim();

  // Post-process
  md = md.replace(/\n{4,}/g, "\n\n\n");
  md = md.replace(/[ 	]+$/gm, "");
  md = md.trim();

  return md;
}

/**
 * Clean up the DOM before conversion
 */
function cleanDocument(body) {
  // Remove scripts, styles, noscript
  body.querySelectorAll("script, style, noscript, link").forEach((el) => el.remove());

  // Remove close buttons and overlays
  body.querySelectorAll("[class*='close'], [class*='overlay'], [class*='modal']").forEach((el) => el.remove());

  // Fix relative image URLs to absolute
  body.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") || "";
    if (src.startsWith("//")) {
      img.setAttribute("src", "https:" + src);
    } else if (src.startsWith("/i") || src.startsWith("/im")) {
      img.setAttribute("src", "https://vk.com" + src);
    }
  });

  // Fix relative links to absolute
  body.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (href.startsWith("//")) {
      a.setAttribute("href", "https:" + href);
    } else if (href.startsWith("/") && !href.startsWith("//") && !href.startsWith("http")) {
      a.setAttribute("href", "https://vk.com" + href);
    }
  });
}

/**
 * Recursively convert DOM nodes to Markdown string
 */
function convertNodes(node) {
  let result = "";

  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      // Text node
      const text = child.textContent;
      if (text && text.trim()) {
        result += text;
      } else if (text && /\s/.test(text)) {
        result += " ";
      }
    } else if (child.nodeType === 1) {
      // Element node
      result += convertElement(child);
    }
  }

  return result;
}

function convertElement(el) {
  const tag = el.tagName.toLowerCase();

  // Ignore certain elements
  if (["script", "style", "noscript", "svg", "link", "meta"].includes(tag)) return "";

  const cls = (el.className || "").toString().toLowerCase();
  if (cls.includes("close") || cls.includes("overlay") || cls.includes("modal")) return "";

  // ─── Headings ───
  if (/^h[1-6]$/.test(tag)) {
    const level = parseInt(tag[1], 10);
    const text = convertNodes(el).trim();
    if (text) return `\n\n${"#".repeat(level)} ${text}\n\n`;
    return "";
  }

  // ─── Paragraphs ───
  if (tag === "p") {
    const inner = convertNodes(el).trim();
    if (inner) return `\n\n${inner}\n\n`;
    return "";
  }

  // ─── Bold/Strong ───
  if (tag === "b" || tag === "strong") {
    const inner = convertNodes(el).trim();
    if (inner) return `**${inner}**`;
    return "";
  }

  // ─── Italic/Em ───
  if (tag === "i" || tag === "em") {
    const inner = convertNodes(el).trim();
    if (inner) return `*${inner}*`;
    return "";
  }

  // ─── Strikethrough ───
  if (tag === "s" || tag === "del" || tag === "strike") {
    const inner = convertNodes(el).trim();
    if (inner) return `~~${inner}~~`;
    return "";
  }

  // ─── Underline (convert to bold since MD doesn't support underline) ───
  if (tag === "u" || tag === "ins") {
    const inner = convertNodes(el).trim();
    if (inner) return `**${inner}**`;
    return "";
  }

  // ─── Line break ───
  if (tag === "br") {
    return "\n";
  }

  // ─── Horizontal rule ───
  if (tag === "hr") {
    return "\n\n---\n\n";
  }

  // ─── Blockquote ───
  if (tag === "blockquote") {
    const inner = convertNodes(el).trim();
    if (inner) {
      const quoted = inner.split("\n").map((line) => `> ${line}`).join("\n");
      return `\n\n${quoted}\n\n`;
    }
    return "";
  }

  // ─── Preformatted/Code blocks ───
  if (tag === "pre") {
    const codeEl = el.querySelector("code");
    const lang = codeEl ? detectLang(codeEl.className || "") : "";
    const text = (codeEl || el).textContent || "";
    if (text.trim()) {
      return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
    }
    return "";
  }

  if (tag === "code") {
    // Check if inside <pre> — if so, handled by pre
    if (el.parentElement?.tagName?.toLowerCase() === "pre") return "";
    const inner = el.textContent || "";
    if (inner.trim()) return `\`${inner}\``;
    return "";
  }

  // ─── Unordered list ───
  if (tag === "ul") {
    const items = convertList(el, false);
    return `\n\n${items}\n\n`;
  }

  // ─── Ordered list ───
  if (tag === "ol") {
    const items = convertList(el, true);
    return `\n\n${items}\n\n`;
  }

  // ─── List item ───
  if (tag === "li") {
    // Handled by ul/ol processing
    return "";
  }

  // ─── Table ───
  if (tag === "table") {
    return convertTable(el);
  }

  // ─── Images ───
  if (tag === "img") {
    const src = el.getAttribute("src") || "";
    const alt = el.getAttribute("alt") || "";
    if (src && !src.startsWith("data:")) {
      return `\n\n![${alt}](${src})\n\n`;
    }
    return "";
  }

  // ─── Links ───
  if (tag === "a") {
    const href = el.getAttribute("href") || "";
    const inner = convertNodes(el).trim();
    if (href && inner) {
      // Skip VK internal navigation links
      if (
        href.startsWith("http") &&
        !href.includes("vk.com/@") &&
        !href.includes("vk.ru/@") &&
        !href.includes("vkuserphoto")
      ) {
        return `[${inner}](${href})`;
      }
      return inner;
    }
    if (href && !inner) {
      // Link with no text (maybe an image link)
      return "";
    }
    return inner || "";
  }

  // ─── Embedded media (iframe, embed) ───
  if (tag === "iframe" || tag === "embed") {
    const src = el.getAttribute("src") || "";
    if (src) {
      return `\n\n> 🎬 [Встроенный контент](${src})\n\n`;
    }
    return "";
  }

  // ─── Div/Span and other containers ───
  if (tag === "div" || tag === "span" || tag === "article" || tag === "section") {
    const inner = convertNodes(el);
    // Add paragraph separation for divs that have block-level content
    if (inner.trim() && hasBlockChildren(el)) {
      return `\n\n${inner.trim()}\n\n`;
    }
    return inner;
  }

  // ─── Default: just convert children ───
  return convertNodes(el);
}

/**
 * Convert a list element to Markdown
 */
function convertList(listEl, ordered) {
  const lines = [];
  const items = listEl.children;
  let index = 1;

  for (const item of items) {
    if (item.tagName.toLowerCase() !== "li") continue;

    // Get text of this item only (not nested lists)
    const clone = item.cloneNode(true);
    clone.querySelectorAll("ul, ol").forEach((l) => l.remove());
    const text = convertNodes(clone).trim();

    // Process nested lists
    const nestedLists = item.querySelectorAll(":scope > ul, :scope > ol");
    let nested = "";
    for (const nestedList of nestedLists) {
      const nestedOrdered = nestedList.tagName.toLowerCase() === "ol";
      const nestedItems = convertList(nestedList, nestedOrdered);
      nested += "\n" + nestedItems.split("\n").map((l) => "  " + l).join("\n");
    }

    if (text) {
      const prefix = ordered ? `${index}.` : "-";
      lines.push(`${prefix} ${text}${nested}`);
      index++;
    }
  }

  return lines.join("\n");
}

/**
 * Convert a table element to Markdown table
 */
function convertTable(tableEl) {
  const rows = tableEl.querySelectorAll("tr");
  if (rows.length === 0) return "";

  const mdRows = [];

  rows.forEach((row) => {
    const cells = row.querySelectorAll("th, td");
    if (cells.length === 0) return;
    const cellsArr = Array.from(cells).map((c) =>
      c.textContent.trim().replace(/\n/g, " ").replace(/\|/g, "\|")
    );
    mdRows.push(cellsArr);
  });

  if (mdRows.length === 0) return "";

  // Determine column count
  const numCols = Math.max(...mdRows.map((r) => r.length));

  // Pad rows to same column count
  mdRows.forEach((r) => {
    while (r.length < numCols) r.push("");
  });

  // Build Markdown table
  const lines = [];
  lines.push("");
  lines.push("| " + mdRows[0].join(" | ") + " |");
  lines.push("| " + mdRows[0].map(() => "---").join(" | ") + " |");
  for (let i = 1; i < mdRows.length; i++) {
    lines.push("| " + mdRows[i].join(" | ") + " |");
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * Check if element has block-level children
 */
function hasBlockChildren(el) {
  const blockTags = ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "blockquote", "pre"];
  for (const child of el.children) {
    if (blockTags.includes(child.tagName.toLowerCase())) return true;
  }
  return false;
}

function detectLang(className) {
  const str = (className || "").toLowerCase();
  if (str.includes("language-js") || str.includes("javascript")) return "javascript";
  if (str.includes("language-ts") || str.includes("typescript")) return "typescript";
  if (str.includes("language-py") || str.includes("python")) return "python";
  if (str.includes("language-html")) return "html";
  if (str.includes("language-css")) return "css";
  if (str.includes("language-bash") || str.includes("shell")) return "bash";
  if (str.includes("language-sql")) return "sql";
  if (str.includes("language-json")) return "json";
  if (str.includes("language-go")) return "go";
  if (str.includes("language-rust")) return "rust";
  return "";
}
